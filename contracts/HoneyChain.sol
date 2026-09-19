// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title HoneyChain
 * @notice Immutable supply chain provenance contract for the Pollinator platform.
 *         Tracks honey batches from beekeeper harvest through to retail sale.
 *         Each state transition emits an on-chain event verifiable on Polygonscan.
 * @dev Uses OpenZeppelin AccessControl for role-gated operations and Pausable
 *      for emergency circuit-breaker functionality.
 */
contract HoneyChain is AccessControl, Pausable {
    // ============================================================
    // Roles
    // ============================================================

    bytes32 public constant BEEKEEPER_ROLE  = keccak256("BEEKEEPER_ROLE");
    bytes32 public constant LAB_ROLE        = keccak256("LAB_ROLE");
    bytes32 public constant PROCESSOR_ROLE  = keccak256("PROCESSOR_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE= keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant RETAILER_ROLE   = keccak256("RETAILER_ROLE");

    // ============================================================
    // Data Structures
    // ============================================================

    /// @notice Lifecycle stages of a honey batch in the supply chain.
    enum BatchStatus {
        Created,        // 0 — Batch registered by beekeeper
        Harvested,      // 1 — Harvest confirmed
        Processed,      // 2 — Processing/extraction complete
        LabVerified,    // 3 — Lab certificate committed on-chain
        Packaged,       // 4 — Bottled into jars
        InDistribution, // 5 — In transit to retailer
        AtRetail,       // 6 — Available at retail point
        Sold,           // 7 — Purchased by consumer
        Recalled        // 8 — Recalled due to fraud or safety concern
    }

    /// @notice Full batch record stored on-chain.
    struct HoneyBatch {
        bytes32     batchIdHash;       // SHA-256 hash of the off-chain batch code string
        address     beekeeper;         // Wallet address of the originating beekeeper
        address     currentCustodian;  // Wallet of current supply chain actor holding the batch
        uint64      harvestTimestamp;  // Unix timestamp of the physical harvest
        uint64      createdAt;         // Block timestamp when this record was created
        uint32      quantityGrams;     // Total honey weight in grams at harvest
        BatchStatus status;            // Current supply chain stage
        string      metadataCID;       // IPFS CID pointing to the full metadata JSON
        bytes32     metadataHash;      // SHA-256 of the IPFS metadata (tamper detection)
        bytes32     labReportHash;     // SHA-256 of the uploaded lab certificate PDF
        bool        labVerified;       // True only after an authorized lab has signed
        bool        recalled;          // True if this batch has been recalled
    }

    // ============================================================
    // State
    // ============================================================

    /// @dev Maps keccak256(batchCode) → HoneyBatch record
    mapping(bytes32 => HoneyBatch) public batches;

    // ============================================================
    // Events — Verifiable on Polygonscan
    // ============================================================

    event BatchCreated(
        bytes32 indexed batchIdHash,
        address indexed beekeeper,
        string          metadataCID,
        bytes32         metadataHash,
        uint32          quantityGrams
    );

    event LabVerified(
        bytes32 indexed batchIdHash,
        address indexed lab,
        bytes32         labReportHash
    );

    event CustodyTransferred(
        bytes32 indexed batchIdHash,
        address indexed from,
        address indexed to,
        uint8           status
    );

    event BatchPackaged(
        bytes32 indexed batchIdHash,
        string          newMetadataCID,
        bytes32         newMetadataHash,
        uint32          jarCount,
        uint32          jarSizeGrams
    );

    event BatchRecalled(
        bytes32 indexed batchIdHash,
        address indexed by,
        string          reasonCID
    );

    // ============================================================
    // Constructor
    // ============================================================

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ============================================================
    // Admin Convenience Functions
    // ============================================================

    /**
     * @notice Grant the BEEKEEPER_ROLE to an account.
     * @dev Shorthand for grantRole(BEEKEEPER_ROLE, account). Only DEFAULT_ADMIN_ROLE.
     */
    function grantBeekeeperRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(BEEKEEPER_ROLE, account);
    }

    /**
     * @notice Grant the LAB_ROLE to an account.
     */
    function grantLabRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(LAB_ROLE, account);
    }

    /**
     * @notice Grant the PROCESSOR_ROLE to an account.
     */
    function grantProcessorRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(PROCESSOR_ROLE, account);
    }

    /**
     * @notice Grant the DISTRIBUTOR_ROLE to an account.
     */
    function grantDistributorRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(DISTRIBUTOR_ROLE, account);
    }

    /**
     * @notice Grant the RETAILER_ROLE to an account.
     */
    function grantRetailerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(RETAILER_ROLE, account);
    }

    // ============================================================
    // Core Batch Functions
    // ============================================================

    /**
     * @notice Register a new honey batch on-chain. Only callable by BEEKEEPER_ROLE.
     * @param _batchIdHash       SHA-256 hash of the off-chain batch code (e.g. "HC-2026-MH01-000123")
     * @param _harvestTimestamp  Unix timestamp of the physical harvest event
     * @param _quantityGrams     Total weight of honey harvested in grams
     * @param _metadataCID       IPFS Content Identifier for the batch metadata JSON
     * @param _metadataHash      SHA-256 hash of the metadata JSON (for tamper detection)
     */
    function createBatch(
        bytes32 _batchIdHash,
        uint64  _harvestTimestamp,
        uint32  _quantityGrams,
        string  memory _metadataCID,
        bytes32 _metadataHash
    ) external onlyRole(BEEKEEPER_ROLE) whenNotPaused {
        require(batches[_batchIdHash].createdAt == 0, "HoneyChain: Batch already exists");
        require(_quantityGrams > 0, "HoneyChain: Quantity must be greater than zero");

        batches[_batchIdHash] = HoneyBatch({
            batchIdHash:      _batchIdHash,
            beekeeper:        msg.sender,
            currentCustodian: msg.sender,
            harvestTimestamp: _harvestTimestamp,
            createdAt:        uint64(block.timestamp),
            quantityGrams:    _quantityGrams,
            status:           BatchStatus.Created,
            metadataCID:      _metadataCID,
            metadataHash:     _metadataHash,
            labReportHash:    bytes32(0),
            labVerified:      false,
            recalled:         false
        });

        emit BatchCreated(_batchIdHash, msg.sender, _metadataCID, _metadataHash, _quantityGrams);
    }

    /**
     * @notice Commit a lab certificate hash on-chain. Only callable by LAB_ROLE.
     * @param _batchIdHash   The batch to verify
     * @param _labReportHash SHA-256 of the uploaded lab certificate PDF
     */
    function verifyLab(
        bytes32 _batchIdHash,
        bytes32 _labReportHash
    ) external onlyRole(LAB_ROLE) whenNotPaused {
        require(batches[_batchIdHash].createdAt != 0, "HoneyChain: Batch does not exist");
        require(!batches[_batchIdHash].recalled, "HoneyChain: Batch is recalled");
        require(!batches[_batchIdHash].labVerified, "HoneyChain: Already lab verified");

        batches[_batchIdHash].labReportHash = _labReportHash;
        batches[_batchIdHash].labVerified   = true;
        batches[_batchIdHash].status        = BatchStatus.LabVerified;

        emit LabVerified(_batchIdHash, msg.sender, _labReportHash);
    }

    /**
     * @notice Transfer custody of a batch to the next supply chain actor.
     * @dev    Only the current custodian can call this. The caller transfers to _to.
     * @param _batchIdHash The batch to transfer
     * @param _to          Wallet address of the receiving actor
     * @param _newStatus   The BatchStatus after this transfer
     */
    function transferCustody(
        bytes32     _batchIdHash,
        address     _to,
        BatchStatus _newStatus
    ) external whenNotPaused {
        require(batches[_batchIdHash].createdAt != 0, "HoneyChain: Batch does not exist");
        require(!batches[_batchIdHash].recalled, "HoneyChain: Batch is recalled");
        
        // Either the caller is the current custodian OR the caller is the central admin relayer
        require(
            batches[_batchIdHash].currentCustodian == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "HoneyChain: Not current custodian or admin relayer"
        );
        require(_to != address(0), "HoneyChain: Cannot transfer to zero address");
        require(_newStatus != BatchStatus.Recalled, "HoneyChain: Use recallBatch to recall");
        require(uint8(_newStatus) >= uint8(batches[_batchIdHash].status), "HoneyChain: Cannot revert status backwards");

        address prev = batches[_batchIdHash].currentCustodian;
        batches[_batchIdHash].currentCustodian = _to;
        batches[_batchIdHash].status           = _newStatus;

        emit CustodyTransferred(_batchIdHash, prev, _to, uint8(_newStatus));
    }

    /**
     * @notice Record batch packaging details on-chain. Only callable by PROCESSOR_ROLE.
     * @dev    Enforces supply chain integrity: packaged quantity cannot exceed harvested quantity.
     * @param _batchIdHash    The batch being packaged
     * @param _jarCount       Number of jars produced
     * @param _jarSizeGrams   Weight of each jar in grams
     * @param _newMetadataCID Updated IPFS CID with packaging details
     * @param _newMetadataHash SHA-256 of the updated metadata JSON
     */
    function packageBatch(
        bytes32 _batchIdHash,
        uint32  _jarCount,
        uint32  _jarSizeGrams,
        string  memory _newMetadataCID,
        bytes32 _newMetadataHash
    ) external onlyRole(PROCESSOR_ROLE) whenNotPaused {
        require(batches[_batchIdHash].createdAt != 0, "HoneyChain: Batch does not exist");
        require(!batches[_batchIdHash].recalled, "HoneyChain: Batch is recalled");
        require(
            batches[_batchIdHash].currentCustodian == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "HoneyChain: Not current custodian or admin relayer"
        );
        require(batches[_batchIdHash].status != BatchStatus.Packaged, "HoneyChain: Batch already packaged");

        // Supply chain integrity: packaged quantity cannot exceed harvested quantity
        uint32 totalPackagedGrams = _jarCount * _jarSizeGrams;
        require(
            totalPackagedGrams <= batches[_batchIdHash].quantityGrams,
            "HoneyChain: Fraud - Packaged quantity exceeds harvested quantity"
        );

        batches[_batchIdHash].metadataCID  = _newMetadataCID;
        batches[_batchIdHash].metadataHash = _newMetadataHash;
        batches[_batchIdHash].status       = BatchStatus.Packaged;

        emit BatchPackaged(_batchIdHash, _newMetadataCID, _newMetadataHash, _jarCount, _jarSizeGrams);
    }

    /**
     * @notice Recall a batch. Only callable by DEFAULT_ADMIN_ROLE.
     * @dev    Sets recalled=true. All QR verifications will show red alert after this.
     * @param _batchIdHash The batch to recall
     * @param _reasonCID   IPFS CID containing the recall reason document
     */
    function recallBatch(
        bytes32 _batchIdHash,
        string  memory _reasonCID
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(batches[_batchIdHash].createdAt != 0, "HoneyChain: Batch does not exist");
        require(!batches[_batchIdHash].recalled, "HoneyChain: Batch already recalled");

        batches[_batchIdHash].recalled = true;
        batches[_batchIdHash].status   = BatchStatus.Recalled;

        emit BatchRecalled(_batchIdHash, msg.sender, _reasonCID);
    }

    // ============================================================
    // Read Functions (Free — No Gas)
    // ============================================================

    /**
     * @notice Get the full batch record. Used by the QR verification page.
     * @param _batchIdHash SHA-256 hash of the batch code
     * @return The full HoneyBatch struct
     */
    function getBatch(bytes32 _batchIdHash) external view returns (HoneyBatch memory) {
        return batches[_batchIdHash];
    }

    /**
     * @notice Get only the batch status. Lightweight read for quick status checks.
     * @param _batchIdHash SHA-256 hash of the batch code
     * @return status The current BatchStatus
     * @return recalled Whether the batch has been recalled
     * @return labVerified Whether a lab has verified this batch
     */
    function getBatchStatus(bytes32 _batchIdHash)
        external
        view
        returns (BatchStatus status, bool recalled, bool labVerified)
    {
        HoneyBatch storage b = batches[_batchIdHash];
        return (b.status, b.recalled, b.labVerified);
    }

    /**
     * @notice Check if a batch exists on-chain.
     * @param _batchIdHash SHA-256 hash of the batch code
     * @return True if the batch was created
     */
    function batchExists(bytes32 _batchIdHash) external view returns (bool) {
        return batches[_batchIdHash].createdAt != 0;
    }

    // ============================================================
    // Emergency Circuit Breaker
    // ============================================================

    /// @notice Pause all state-changing operations. Only DEFAULT_ADMIN_ROLE.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Resume operations. Only DEFAULT_ADMIN_ROLE.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
