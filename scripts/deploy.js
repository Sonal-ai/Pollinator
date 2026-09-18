const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying HoneyChain to Polygon Amoy...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MATIC\n");

  const HoneyChain = await ethers.getContractFactory("HoneyChain");
  const honeyChain = await HoneyChain.deploy();
  await honeyChain.waitForDeployment();

  const contractAddress = await honeyChain.getAddress();

  console.log("✅ HoneyChain deployed to:", contractAddress);
  console.log("📡 Polygonscan:", `https://amoy.polygonscan.com/address/${contractAddress}`);

  // Save address to file for reference
  const deployedInfo = {
    address: contractAddress,
    deployer: deployer.address,
    network: "polygon-amoy",
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.join(__dirname, "../deployed-address.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployedInfo, null, 2));
  console.log("\n📄 Saved to deployed-address.json");
  console.log("\n🔧 Add to your .env file:");
  console.log(`CONTRACT_ADDRESS=${contractAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
