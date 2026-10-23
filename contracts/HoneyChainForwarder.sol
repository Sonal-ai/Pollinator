// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

// Standard EIP-712 nonce/deadline verification; the relayer receives no registry role.
contract HoneyChainForwarder is ERC2771Forwarder {
    constructor() ERC2771Forwarder("HoneyChainForwarder") {}
}
