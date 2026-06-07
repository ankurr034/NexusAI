const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const PremiumSubscription = await hre.ethers.getContractFactory("PremiumSubscription");
  const premiumSubscription = await PremiumSubscription.deploy();
  await premiumSubscription.waitForDeployment();
  const premiumAddress = await premiumSubscription.getAddress();
  console.log("PremiumSubscription deployed to:", premiumAddress);

  const PredictionLogger = await hre.ethers.getContractFactory("PredictionLogger");
  const predictionLogger = await PredictionLogger.deploy();
  await predictionLogger.waitForDeployment();
  const predictionAddress = await predictionLogger.getAddress();
  console.log("PredictionLogger deployed to:", predictionAddress);

  // Save the addresses to a config file for the backend/frontend to use
  const configDir = path.join(__dirname, "../src");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const addresses = {
    PremiumSubscription: premiumAddress,
    PredictionLogger: predictionAddress
  };

  fs.writeFileSync(
    path.join(configDir, "contractAddresses.json"),
    JSON.stringify(addresses, null, 2)
  );
  
  console.log("Addresses saved to src/contractAddresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
