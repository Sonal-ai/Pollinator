const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

async function main() {
  const networkName = hre.network.name;
  const isLocal = networkName === "localhost" || networkName === "hardhat";
  const currencySymbol = isLocal ? "ETH" : "MATIC";

  console.log(`🚀 Deploying HoneyChain to ${isLocal ? "Local Hardhat (" + networkName + ")" : "Polygon Amoy"}...\n`);

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer signer found! Ensure accounts or private key are configured.");
  }
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ${currencySymbol}\n`);

  const HoneyChain = await ethers.getContractFactory("HoneyChain");
  const honeyChain = await HoneyChain.deploy();
  await honeyChain.waitForDeployment();

  const contractAddress = await honeyChain.getAddress();

  console.log("✅ HoneyChain deployed to:", contractAddress);
  if (!isLocal) {
    console.log("📡 Polygonscan:", `https://amoy.polygonscan.com/address/${contractAddress}`);
  } else {
    console.log("💻 Running locally on Hardhat node (http://127.0.0.1:8545)");
  }

  // Load existing deployed-address.json if present
  const outputPath = path.join(__dirname, "../deployed-address.json");
  let existingData = {};
  try {
    if (fs.existsSync(outputPath)) {
      existingData = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    }
  } catch {
    existingData = {};
  }

  const networks = existingData.networks || {};
  const currentNetworkKey = isLocal ? "localhost" : "polygon-amoy";

  // If old structure had polygon-amoy address but no networks map, preserve it
  if (!networks["polygon-amoy"] && existingData.network === "polygon-amoy" && existingData.address) {
    networks["polygon-amoy"] = {
      address: existingData.address,
      deployer: existingData.deployer,
      deployedAt: existingData.deployedAt,
    };
  }

  networks[currentNetworkKey] = {
    address: contractAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const deployedInfo = {
    address: contractAddress,
    deployer: deployer.address,
    network: currentNetworkKey,
    deployedAt: new Date().toISOString(),
    networks,
  };

  fs.writeFileSync(outputPath, JSON.stringify(deployedInfo, null, 2));
  console.log("\n📄 Saved to deployed-address.json");
  console.log("\n🔧 Environment variable settings:");
  if (isLocal) {
    console.log(`BLOCKCHAIN_NETWORK="local"`);
    console.log(`LOCAL_CONTRACT_ADDRESS=${contractAddress}`);
  } else {
    console.log(`BLOCKCHAIN_NETWORK="amoy"`);
    console.log(`CONTRACT_ADDRESS=${contractAddress}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
