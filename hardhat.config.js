require('dotenv').config()

require("@nomiclabs/hardhat-truffle5")
require("@nomiclabs/hardhat-etherscan")
require('@openzeppelin/hardhat-upgrades');
require("solidity-coverage")


const chai = require('chai')
const BN = require('bn.js')

chai.use(require('chai-bn')(BN))

module.exports = {
  solidity: {
    version: "0.8.13",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000
      }
    }
  },

  networks: {
     localhost: {
      url: 'http://localhost:8545',
      accounts: [process.env.PRIVATE_KEY_LOCAL],
    },
  },

  etherscan: {
		apiKey: process.env.ETHERSCAN_KEY
  },
  paths: {
    sources: "./contracts"
  }
};
