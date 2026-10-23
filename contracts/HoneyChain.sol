// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @notice Honey provenance registry v2. Records attributable declarations, not physical purity.
 * @dev ERC-2771 lets an unprivileged relayer pay gas for actor-signed requests.
 *      No admin custody override. Deploy a new registry; v1 storage is not upgraded in place.
 */
contract HoneyChain is AccessControl, Pausable, ERC2771Context {
    bytes32 public constant BEEKEEPER_ROLE = keccak256("BEEKEEPER_ROLE");
    bytes32 public constant LAB_ROLE = keccak256("LAB_ROLE");
    bytes32 public constant PROCESSOR_ROLE = keccak256("PROCESSOR_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER_ROLE");

    // Numeric values retained for API compatibility. New registrations start at Harvested.
    enum BatchStatus { Created, Harvested, Processed, LabVerified, Packaged, InDistribution, AtRetail, Sold, Recalled }
    struct HoneyBatch {
        bytes32 batchIdHash; // keccak256(UTF-8 batch code)
        address beekeeper;
        address currentCustodian;
        uint64 harvestTimestamp;
        uint64 createdAt;
        uint32 quantityGrams;
        BatchStatus status;
        string metadataCID;
        bytes32 metadataHash; // SHA-256 of exact stored bytes
        bytes32 labReportHash;
        bool labVerified;
        bool recalled;
        uint32 jarCount;
        uint32 jarSizeGrams;
        uint64 packagedGrams;
        address labVerifier;
        string harvestMetadataCID;
        bytes32 harvestMetadataHash;
    }
    mapping(bytes32 => HoneyBatch) private batches;
    event BatchCreated(bytes32 indexed batchIdHash, address indexed beekeeper, string metadataCID, bytes32 metadataHash, uint32 quantityGrams);
    event LabVerified(bytes32 indexed batchIdHash, address indexed lab, bytes32 labReportHash);
    event CustodyTransferred(bytes32 indexed batchIdHash, address indexed from, address indexed to, uint8 status);
    event BatchPackaged(bytes32 indexed batchIdHash, string newMetadataCID, bytes32 newMetadataHash, uint32 jarCount, uint32 jarSizeGrams);
    event BatchRecalled(bytes32 indexed batchIdHash, address indexed by, string reasonCID);

    constructor(address forwarder) ERC2771Context(forwarder) {
        require(forwarder == address(0) || forwarder.code.length > 0, "HoneyChain: Forwarder must be a contract");
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    function registryVersion() external pure returns (uint256) { return 2; }
    function grantBeekeeperRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) { _grantRole(BEEKEEPER_ROLE, account); }
    function grantLabRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) { _grantRole(LAB_ROLE, account); }
    function grantProcessorRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) { _grantRole(PROCESSOR_ROLE, account); }
    function grantDistributorRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) { _grantRole(DISTRIBUTOR_ROLE, account); }
    function grantRetailerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) { _grantRole(RETAILER_ROLE, account); }

    function createBatch(bytes32 id, uint64 harvestedAt, uint32 quantity, string calldata cid, bytes32 contentHash)
        external onlyRole(BEEKEEPER_ROLE) whenNotPaused
    {
        require(batches[id].createdAt == 0, "HoneyChain: Batch already exists");
        require(id != bytes32(0), "HoneyChain: Empty batch ID");
        require(quantity > 0, "HoneyChain: Quantity must be greater than zero");
        require(harvestedAt > 0 && harvestedAt <= block.timestamp, "HoneyChain: Invalid harvest timestamp");
        _requireEvidence(cid, contentHash);
        HoneyBatch storage b = batches[id];
        b.batchIdHash = id;
        b.beekeeper = _msgSender();
        b.currentCustodian = _msgSender();
        b.harvestTimestamp = harvestedAt;
        b.createdAt = uint64(block.timestamp);
        b.quantityGrams = quantity;
        b.status = BatchStatus.Harvested;
        b.metadataCID = cid;
        b.metadataHash = contentHash;
        b.harvestMetadataCID = cid;
        b.harvestMetadataHash = contentHash;
        emit BatchCreated(id, _msgSender(), cid, contentHash, quantity);
    }

    function verifyLab(bytes32 id, bytes32 reportHash) external onlyRole(LAB_ROLE) whenNotPaused {
        HoneyBatch storage b = _active(id);
        require(!b.labVerified, "HoneyChain: Already lab verified");
        require(b.status == BatchStatus.Processed, "HoneyChain: Processed stage required");
        require(b.currentCustodian == _msgSender(), "HoneyChain: Not current custodian");
        require(reportHash != bytes32(0), "HoneyChain: Empty report hash");
        require(b.beekeeper != _msgSender(), "HoneyChain: Independent lab required");
        b.labReportHash = reportHash;
        b.labVerifier = _msgSender();
        b.labVerified = true;
        b.status = BatchStatus.LabVerified;
        emit LabVerified(id, _msgSender(), reportHash);
    }

    /**
     * @notice Same-stage handovers preserve evidence state. Only explicit next stages may advance.
     * Harvested -> Processed is a processor declaration. Lab and packaging use dedicated functions.
     * AtRetail -> Sold records a retailer declaration; consumer wallet details are not required.
     */
    function transferCustody(bytes32 id, address to, BatchStatus next) external whenNotPaused {
        HoneyBatch storage b = _active(id);
        address actor = _msgSender();
        require(b.currentCustodian == actor, "HoneyChain: Not current custodian");
        require(to != address(0), "HoneyChain: Cannot transfer to zero address");
        require(b.status != BatchStatus.Sold, "HoneyChain: Sold batch is terminal");
        if (next != b.status) {
            bool valid =
                (b.status == BatchStatus.Harvested && next == BatchStatus.Processed && hasRole(PROCESSOR_ROLE, actor)) ||
                (b.status == BatchStatus.Packaged && next == BatchStatus.InDistribution) ||
                (b.status == BatchStatus.InDistribution && next == BatchStatus.AtRetail) ||
                (b.status == BatchStatus.AtRetail && next == BatchStatus.Sold && to == actor && hasRole(RETAILER_ROLE, actor));
            require(valid, "HoneyChain: Invalid stage transition");
        } else {
            require(to != actor, "HoneyChain: Empty handover");
        }
        require(_eligibleRecipient(to, next), "HoneyChain: Recipient role does not match stage");
        b.currentCustodian = to;
        b.status = next;
        emit CustodyTransferred(id, actor, to, uint8(next));
    }

    function packageBatch(bytes32 id, uint32 count, uint32 sizeGrams, string calldata cid, bytes32 contentHash)
        external onlyRole(PROCESSOR_ROLE) whenNotPaused
    {
        HoneyBatch storage b = _active(id);
        require(b.currentCustodian == _msgSender(), "HoneyChain: Not current custodian");
        require(b.jarCount == 0, "HoneyChain: Batch already packaged");
        require(b.status == BatchStatus.LabVerified && b.labVerified, "HoneyChain: Lab verification required");
        require(count > 0 && sizeGrams > 0, "HoneyChain: Empty packaging");
        uint256 mass = uint256(count) * uint256(sizeGrams);
        require(mass <= b.quantityGrams, "HoneyChain: Fraud - Packaged quantity exceeds harvested quantity");
        _requireEvidence(cid, contentHash);
        b.jarCount = count;
        b.jarSizeGrams = sizeGrams;
        b.packagedGrams = uint64(mass);
        b.metadataCID = cid;
        b.metadataHash = contentHash;
        b.status = BatchStatus.Packaged;
        emit BatchPackaged(id, cid, contentHash, count, sizeGrams);
    }

    // Recall remains available during an emergency pause.
    function recallBatch(bytes32 id, string calldata reasonCID) external onlyRole(DEFAULT_ADMIN_ROLE) {
        HoneyBatch storage b = batches[id];
        require(b.createdAt != 0, "HoneyChain: Batch does not exist");
        require(!b.recalled, "HoneyChain: Batch already recalled");
        require(bytes(reasonCID).length > 0 && bytes(reasonCID).length <= 128, "HoneyChain: Recall reason required");
        b.recalled = true;
        b.status = BatchStatus.Recalled;
        emit BatchRecalled(id, _msgSender(), reasonCID);
    }
    function getBatch(bytes32 id) external view returns (HoneyBatch memory) { return batches[id]; }
    function getBatchStatus(bytes32 id) external view returns (BatchStatus status, bool recalled, bool labVerified) {
        HoneyBatch storage b = batches[id];
        require(b.createdAt != 0, "HoneyChain: Batch does not exist");
        return (b.status, b.recalled, b.labVerified);
    }
    function batchExists(bytes32 id) external view returns (bool) { return batches[id].createdAt != 0; }
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function _active(bytes32 id) private view returns (HoneyBatch storage b) {
        b = batches[id];
        require(b.createdAt != 0, "HoneyChain: Batch does not exist");
        require(!b.recalled, "HoneyChain: Batch is recalled");
    }
    function _requireEvidence(string calldata cid, bytes32 contentHash) private pure {
        // CID decoding is off-chain. This bound prevents empty or unbounded commitments.
        require(bytes(cid).length > 0 && bytes(cid).length <= 128 && contentHash != bytes32(0), "HoneyChain: Evidence commitment required");
    }
    function _eligibleRecipient(address to, BatchStatus stage) private view returns (bool) {
        if (stage == BatchStatus.Harvested) return hasRole(BEEKEEPER_ROLE, to) || hasRole(PROCESSOR_ROLE, to);
        if (stage == BatchStatus.Processed || stage == BatchStatus.LabVerified) return hasRole(PROCESSOR_ROLE, to) || hasRole(LAB_ROLE, to);
        if (stage == BatchStatus.Packaged) return hasRole(PROCESSOR_ROLE, to);
        if (stage == BatchStatus.InDistribution) return hasRole(DISTRIBUTOR_ROLE, to);
        if (stage == BatchStatus.AtRetail || stage == BatchStatus.Sold) return hasRole(RETAILER_ROLE, to);
        return false;
    }
    function _msgSender() internal view override(Context, ERC2771Context) returns (address) { return ERC2771Context._msgSender(); }
    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) { return ERC2771Context._msgData(); }
    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) { return ERC2771Context._contextSuffixLength(); }
}
