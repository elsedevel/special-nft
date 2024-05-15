const {expectEvent, expectRevert} = require('@openzeppelin/test-helpers');
const chaiAsPromised = require('chai-as-promised');
const chai = require('chai');

chai.use(chaiAsPromised);
const { expect } = chai;

const {ethers, artifacts, web3} = require('hardhat');

const BN = web3.utils.BN;

const DaoV1 = artifacts.require('DaoV1');
const VipCards = artifacts.require('VipCards');

contract('VipCards', ([D, a0]) => {

  beforeEach(async function () {
    const dao = await DaoV1.new([a0], [73, 27], {from: D});
    this.VipCards = await VipCards.new(dao.address, { from: D });
  })

  describe('init tests', () => {
    it('should instantiate as ERC-165 supporting ERC-721 token', async function () {
      expect(await this.VipCards.supportsInterface('0x80ac58cd')).to.equal(true)
    })
  })

  describe('set base uri', () => {
    it('should not be able to set base uri without correct role', async function () {
      const newBaseURI = 'abc';

      await expectRevert.unspecified(
        this.VipCards.setBaseURI(newBaseURI, { from: a0 })
      )
    })
  })
  
  describe('tokenURI', () => {
    it('should fail if token does not exist', async function () {
      await expectRevert(
        this.VipCards.tokenURI(5),
        'ERC721Metadata: URI query for nonexistent token'
      )
    })
  })

  describe('tiers and mint cards', () => {
    beforeEach(async function () {
      await this.VipCards.addTierForMint(1, 0, 100, new Date().getTime() + 5000);
    })


    it('should not be able to mint more than max mint amount', async function () {
      await expectRevert(
          this.VipCards.mintCards(20, 1),
          'amount should not exceed max mint amount'
      )
    })

    it('should not be able to mint from non existing tier', async function () {
      await expectRevert(
          this.VipCards.mintCards(1, 2),
          'tier is not defined'
      )
    })

    it('free tier should be created', async function () {
      await expectRevert(
          this.VipCards.addTierForMint(1, 0, 200, new Date().getTime() + 5000),
          'tier already defined'
      )
    })

    it('whitelist should be created', async function () {
      await this.VipCards.addWhitelistForMint(a0, 1, 10, 1);
      expect(await this.VipCards.whitelistForMint.call(a0, 1)).property('amount').to.bignumber.equal(new BN(10));
    })

    it('should get proper active min tier', async function () {
      await this.VipCards.addWhitelistForMint(a0, 1, 10, 1);
      expect(await this.VipCards.activeMinTiersPerUser.call(a0)).to.bignumber.equal(new BN(1));
    })

    it('wildcard whitelist should be created', async function () {
      await this.VipCards.addWildcardWhitelist(1, 20, 1);
      expect(await this.VipCards.wildcardWhitelist.call(1)).property('amount').to.bignumber.equal(new BN(20));
    })

    it('should get user active tier', async function () {
      await ethers.provider.send('evm_setNextBlockTimestamp', [new Date().getTime() + 60000]);
      await ethers.provider.send('evm_mine');
      await this.VipCards.addWhitelistForMint(a0, 1, 10, 1);
      const tier = await this.VipCards.getUserActiveTier.call(a0);
      expect(tier[0].toString()).equal('1');
      expect(tier[2].toString()).equal('10');
    })
  })

  describe('free tier', () => {
    it('tier with id 1 should be free tier', async function () {
      await expectRevert(
          this.VipCards.addTierForMint(1, 10, 100, new Date().getTime() + 100000),
          'tier with id 1 should be free tier'
      )
    })
  })
})
