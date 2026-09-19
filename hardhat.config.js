require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const networkMode = (process.env.BLOCKCHAIN_NETWORK || "local").toLowerCase();
const isTestRun = process.argv.includes("test");

const defaultNetwork = isTestRun
  ? "hardhat"
  : networkMode === "amoy" || networkMode === "polygonamoy" || networkMode === "global"
    ? "polygonAmoy"
    : "localhost";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork,
  solidity: "0.8.20",
  networks: {
    hardhat: {},
    localhost: {
      url: process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545",
      chainId: 31337,
    },
    polygonAmoy: {
      url: process.env.POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 2000000000 // 2 Gwei
    }
  }
};
