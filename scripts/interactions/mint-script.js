const hre = require("hardhat");
const {artifacts, web3} = require('hardhat')

async function main() {
  const NFT = await hre.ethers.getContractFactory("CardNFT");  
  const URI = "ipfs://QmZu6UUBHo2bHLiRMZCoQf6hiSmnFVVzWqyEAyF9SJwxhx"
  const WALLET_ADDRESS = "YOUR WALLET ADDRESS"
  const CONTRACT_ADDRESS = "YOUR CONTRACT ADDRESS"
  const contract = NFT.attach(CONTRACT_ADDRESS);

  await contract.mint(WALLET_ADDRESS, URI);
  console.log("NFT minted:", contract);

  contract.on("eventName", ( caller,tokenID) => {
    //this section is called every time an event is emitted 
})
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
