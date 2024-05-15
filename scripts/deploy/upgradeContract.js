const { ethers, upgrades } = require("hardhat");

//the address of the deployed proxy
const PROXY = "add adrress here";

async function main() {
    const DaoV2 = await ethers.getContractFactory("DaoV2");
    console.log("Upgrading Dao......");
    const upgraded = await upgrades.upgradeProxy(PROXY, DaoV2);
    console.log((await upgraded.area()).toString());
    console.log((await upgraded.perimeter()).toString());
    console.log("DAO upgraded");
}

main();