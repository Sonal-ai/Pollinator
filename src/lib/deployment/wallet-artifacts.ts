import {ethers} from 'ethers';
import forwarder from '../../../artifacts/contracts/HoneyChainForwarder.sol/HoneyChainForwarder.json';
import registry from '../../../artifacts/contracts/HoneyChain.sol/HoneyChain.json';
export const deploymentArtifacts={forwarder,registry};
export const deploymentTemplateHash=ethers.keccak256(ethers.concat([ethers.getBytes(forwarder.bytecode),ethers.getBytes(registry.bytecode)]));
