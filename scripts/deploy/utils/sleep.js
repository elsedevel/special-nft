/**
 * Sleeps for a specified amount of milliseconds
 * @param {number} ms
 * @returns {Promise}
 */
module.exports = function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
