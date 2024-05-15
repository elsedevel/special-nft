const RLP = require('rlp');

/**
 * Returns whether an address is a contract
 *
 * @param {Web3} web3
 * @param {string} address
 * @returns {boolean}
 */
module.exports = async function addressIsContract(web3, address) {
  return await web3.eth.getCode(address) !== '0x';
}
