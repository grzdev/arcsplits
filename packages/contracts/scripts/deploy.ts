import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("==================================================");
  console.log(`Deploying ArcSplits to network: ${network.name}`);
  console.log(`Deployer address: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} USDC`);
  console.log("==================================================");

  // 1. Deploy Factory
  const Factory = await ethers.getContractFactory("ArcSplitFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`ArcSplitFactory deployed at: ${factoryAddress}`);

  // 2. Create Initial Showcase Split
  console.log("\nCreating Initial Arc Showcase Split...");
  const recipients = [
    deployer.address, // Deployer (50%)
    "0x000000000000000000000000000000000000dEaD", // Burn / Reserve (50%)
  ];
  const shares = [5000, 5000];

  const tx = await factory.createSplit(
    "Arc Genesis Showcase Split",
    recipients,
    shares
  );
  const receipt = await tx.wait();
  const showcaseSplitAddress = await factory.allSplits(0);
  console.log(`Showcase Split created at: ${showcaseSplitAddress}`);

  // Save deployment metadata
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentData = {
    network: network.name,
    chainId: network.config.chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    factory: factoryAddress,
    showcaseSplit: showcaseSplitAddress,
  };

  const filePath = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(deploymentData, null, 2));
  console.log(`\nDeployment metadata saved to: ${filePath}`);
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
