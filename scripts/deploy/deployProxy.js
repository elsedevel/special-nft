const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());


  const DaoV1 = await ethers.getContractFactory("DaoV1");
  
  //change address
  const proxy = await upgrades.deployProxy(DaoV1, [['add shareholders adreesses here'], [100000]]);
  
  await proxy.deployed();
  console.log(proxy.address);
}

main();