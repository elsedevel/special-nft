const {constants, expectEvent, expectRevert} = require('@openzeppelin/test-helpers');
const {ZERO_ADDRESS} = constants;

const {artifacts, web3, expect, ethers, upgrades} = require('hardhat')

const BN = web3.utils.BN;


contract('DaoV1', (accounts) => {
  const [owner, ...other] = accounts

  const ownership = [72931, 27069]

  const sender = other[ownership.length];

  beforeEach(async function () {
    this.DaoV1 = await ethers.getContractFactory('DaoV1');
    this.dao = await upgrades.deployProxy(this.DaoV1, [[
      other[0], other[1]
    ], ownership], { initializer: 'initialize' });
    await this.dao.deployed();
  });

  describe('change shareholders', function () {
    it('should allow owner to change shareholders', async function () {
      const tx = await this.dao.changeShareholders([other[1], other[0]], [30000, 70000]);
      const changeShareholders = await tx.wait();
      const events = [];

      for (const event of changeShareholders.events) {
        events.push(event.event);
      }

      // expectEvent was NOT working here
      const hasShareholdersEvent = events.includes('ShareholdersChanged');

      expect(hasShareholdersEvent).equal(true);
    })

    it('should not be able to change shareholders if array length does not match', async function () {
      await expectRevert(this.dao.changeShareholders([
        other[1], other[0]
      ], [30000], {from: owner}), 'incompatible array length')
    })

    it('should not be able to change shareholders if ownership is less than 100000', async function () {
      await expectRevert(this.dao.changeShareholders([
        other[1], other[0]
      ], [
        30000, 30000
      ], {from: owner}), 'ownership must sum to 100')
    })

    it('should not be able to change shareholders if ownership is more than 100000', async function () {
      await expectRevert(this.dao.changeShareholders([
        other[1], other[0]
      ], [
        30000, 80000
      ], {from: owner}), 'ownership must sum to 100')
    })

    it('should not accept 0 address as shareholder', async function () {
      await expectRevert(this.dao.changeShareholders([
        other[1], ZERO_ADDRESS
      ], [
        30000, 70000
      ], {from: owner}), 'zero address not accepted')
    })

    it('should not accept no shareholders', async function () {
      await expectRevert(this.dao.changeShareholders([], [], {from: owner}), 'no shareholders')
    })
  })

  describe('distribute to shareholders', function () {
    it('should distribute the correct amount of funds to the shareholders', async function () {
      const amount = new BN(web3.utils.toWei('1', 'ether'))
      const tx = await this.dao.distributeToShareholders({value: amount.toString()})
      const distribute = await tx.wait();

      const events = [];

      for (const event of distribute.events) {
        events.push(event.event);
      }

      const hasPayoutEvent = events.includes('Payout');

      expect(hasPayoutEvent).equal(true);

      const values = [
        await this.dao.shareholderBalance(other[0]),
        await this.dao.shareholderBalance(other[1])
      ]

      values.forEach((value, i) => {
        expect(value.eq((amount * new BN(ownership[i]) / new BN(100000)).toString())).equal(true)
      })
    })
  })

  describe('fallback', function () {
    it('should distribute the correct amount of funds to the shareholders when Ether is received', async function () {
      let amount = new BN(web3.utils.toWei('1', 'ether'))


      await web3.eth.sendTransaction({
        from: sender,
        to: this.dao.address,
        value: amount.toString()
      })

      const values = [
        await this.dao.shareholderBalance(other[0]),
        await this.dao.shareholderBalance(other[1]),
      ]

      values.forEach((value, i) => {
        expect(value.eq((amount * new BN(ownership[i]) / new BN(100000)).toString())).equal(true)
      })
    })
  })

  describe('withdraw', function () {
    it('should let each shareholder withdraw his exact balance', async function () {
      const amount = new BN(web3.utils.toWei('1', 'ether'))
      const [owner, ...otherAccounts] = await ethers.getSigners();

      await this.dao.distributeToShareholders({value: amount.toString()})

      const values = [
        await this.dao.shareholderBalance(other[0]),
        await this.dao.shareholderBalance(other[1]),
      ]

      for (let i = 0; i < values.length; i++) {
        const value = values[i]

        const tx = await this.dao.connect(otherAccounts[i]).withdraw(value);
        const withdraw = await tx.wait();
        const events = [];

        for (const event of withdraw.events) {
          events.push(event.event);
        }

        // expectEvent was NOT working here
        const hasWithdrawEvent = events.includes('Withdraw');

        expect(hasWithdrawEvent).equal(true);
      }
    })

    it('should let each shareholder withdraw less than his exact balance', async function () {
      const amount = new BN(web3.utils.toWei('1', 'ether'))
      const [owner, ...otherAccounts] = await ethers.getSigners();

      await this.dao.distributeToShareholders({value: amount.toString()})

      const values = [
        await this.dao.shareholderBalance(other[0]),
        await this.dao.shareholderBalance(other[1]),
      ]

      for (let i = 0; i < values.length; i++) {
        const value = values[i];

        const tx = await this.dao.connect(otherAccounts[i]).withdraw(value.div(new BN(2).toString()))

        const withdraw = await tx.wait();
        const events = [];

        for (const event of withdraw.events) {
          events.push(event.event);
        }

        // expectEvent was NOT working here
        const hasWithdrawEvent = events.includes('Withdraw');

        expect(hasWithdrawEvent).equal(true);
      }
    })

    it('should not let a shareholder withdraw more than his balance', async function () {
      const amount = new BN(web3.utils.toWei('1', 'ether'));
      const [owner, ...otherAccounts] = await ethers.getSigners();

      await this.dao.distributeToShareholders({value: amount.toString()})

      const values = [
        await this.dao.shareholderBalance(other[0]),
        await this.dao.shareholderBalance(other[1]),
      ]

      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        await expectRevert(this.dao.connect(otherAccounts[i]).withdraw(value.mul(new BN(2).toString())), 'not enough funds')
      }
    })
  })

  describe('force withdraw', function () {
    it('should let owner force withdraw funds from shareholders', async function () {
      const amount = new BN(web3.utils.toWei('1', 'ether'));
      const [ownerAccount] = await ethers.getSigners();

      await this.dao.distributeToShareholders({value: amount.toString()})

      const values = [
        await this.dao.shareholderBalance(other[0]),
        await this.dao.shareholderBalance(other[1]),
      ]

      for (let i = 0; i < values.length; i++) {
        const value = values[i]
        const shareholder = other[i]

        const tx = await this.dao.connect(ownerAccount).forceWithdraw(shareholder, value)

        const forceWithdraw = await tx.wait();
        const events = [];

        for (const event of forceWithdraw.events) {
          events.push(event.event);
        }

        // expectEvent was NOT working here
        const hasForceWithdrawEvent = events.includes('ForceWithdraw');

        expect(hasForceWithdrawEvent).equal(true);
      }
    })

    it('should not let owner force withdraw more funds than available from shareholders', async function () {
      const amount = new BN(web3.utils.toWei('1', 'ether'));
      const [ownerAccount] = await ethers.getSigners();

      await this.dao.distributeToShareholders({value: amount.toString()})

      const values = [
        await this.dao.shareholderBalance(other[0]),
        await this.dao.shareholderBalance(other[1]),
      ]

      for (let i = 0; i < values.length; i++) {
        const value = values[i]
        const shareholder = other[i]

        await expectRevert(this.dao.connect(ownerAccount).forceWithdraw(shareholder, value.mul((new BN(2)).toString())), 'not enough funds')
      }
    })
  })

  describe('dangerous force withdraw', function () {
    it('should let owner dangerous force withdraw funds from the contract', async function () {
      const amount = new BN(web3.utils.toWei('1', 'ether')).toString();
      const [ownerAccount] = await ethers.getSigners();

      await this.dao.distributeToShareholders({value: amount});

      const tx = await this.dao.connect(ownerAccount).dangerousForceWithdraw(amount)

      const dangerousForceWithdraw = await tx.wait();
      const events = [];

      for (const event of dangerousForceWithdraw.events) {
        events.push(event.event);
      }

      // expectEvent was NOT working here
      const hasDangerousForceWithdrawEvent = events.includes('DangerousForceWithdraw');

      expect(hasDangerousForceWithdrawEvent).equal(true);
    })

    it('should not let non-owner dangerous force withdraw funds from the contract', async function () {
      const amount = new BN(web3.utils.toWei('1', 'ether')).toString();
      const [ownerAccount, senderAccount] = await ethers.getSigners();

      await this.dao.distributeToShareholders({value: amount});

      await expectRevert(this.dao.connect(senderAccount).dangerousForceWithdraw(amount), 'Ownable: caller is not the owner')
    })
  })
})
