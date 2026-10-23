require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

// Use the pinned npm compiler for reproducible offline builds.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async ({ solcVersion }, _hre, runSuper) => {
  const localVersion = require("solc").version();
  if (localVersion.startsWith(solcVersion + "+")) {
    return { compilerPath: require.resolve("solc/soljson.js"), isSolcJs: true, version: solcVersion, longVersion: localVersion };
  }
  return runSuper();
});

const networkMode = (process.env.BLOCKCHAIN_NETWORK || "local").toLowerCase();
const isTestRun = process.argv.includes("test");
if (process.env.HONEYCHAIN_QA_CHAIN_ID && process.env.HONEYCHAIN_QA_CHAIN_ID !== '80002') throw new Error('The optional QA chain ID must be 80002; otherwise omit it for normal local chain 31337.');
const localChainId = process.env.HONEYCHAIN_QA_CHAIN_ID ? 80002 : 31337;

const defaultNetwork = isTestRun
  ? "hardhat"
  : networkMode === "amoy" || networkMode === "polygonamoy" || networkMode === "global"
    ? "polygonAmoy"
    : "localhost";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork,
  solidity: { version: "0.8.26", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" } },
  networks: {
    hardhat: { chainId: localChainId },
    localhost: {
      url: process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545",
      chainId: localChainId,
    },
    polygonAmoy: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-amoy.drpc.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    }
  }
};
