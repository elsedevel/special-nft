const RLP = require('rlp');

/**
 * Returns the address of the next contract deployed by an account
 *
 * https://ethereum.stackexchange.com/questions/760/how-is-the-address-of-an-ethereum-contract-computed
 *
 * @param {Web3} web3
 * @param {string} deployerAddress
 * @returns {string}
 */
module.exports = async function calculateNextContractAddress(web3, deployerAddress) {
  const nonce = await web3.eth.getTransactionCount(deployerAddress);

  const addr = `0x${
    web3.utils.sha3(RLP.encode([deployerAddress, nonce])).slice(12).substring(14)
  }`;

  return web3.utils.toChecksumAddress(addr);
}
