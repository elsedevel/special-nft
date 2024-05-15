// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./VipCardStaking.sol";


/**
 * @title  DAO
 *
 * @notice DAO used to distributes funds from the Project incomes
 */
contract DaoV1 is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
  /**
   * @notice Addresses of the current DAO shareholders
   */
  address[] public shareholders;

  /**
   * @notice Ownership percentage of the current DAO shareholders
   *
   * @dev All ownerships must add up to 100.000 (100% ownership)
   */
  uint256[] public shareholderOwnership;

  /** 
   * @notice Current balance of shareholders
   *
   * @notice Will also include balance of old shareholders who have not yet withdrawn their funds
   */
  mapping(address => uint256) public shareholderBalance;


  /**
   * @notice Current balance of stakeholders
   */
  mapping(address => uint256) public stakeHoldersReward;

  /**
   * @dev Will allow execution only if shareholder with address 'addr' has at least 'amount' wei in his balance
   */
  modifier onlyIfShareholderHasBalance(address addr, uint256 amount) {
    require(shareholderBalance[addr] >= amount, "not enough funds");
    _;
  }


  /**
   * @dev Fired in changeShareholders()
   *
   * @param oldShareholders new shareholder addresses
   * @param oldShareholderOwnership new shareholder ownerships
   * @param newShareholders new shareholder addresses
   * @param newShareholderOwnership new shareholder ownerships
   */
  event ShareholdersChanged(
    address[] oldShareholders,
    uint256[] oldShareholderOwnership,
    address[] newShareholders,
    uint256[] newShareholderOwnership
  );

  /**
   * @dev Fired in distributeToShareholders()
   *
   * @param shareholders current shareholders
   * @param shareholderOwnership current shareholder ownership
   * @param value value in wei to be split between shareholders
   */
  event Payout(address[] shareholders, uint256[] shareholderOwnership, uint256 value);

  /**
   * @dev Fired in withdraw()
   *
   * @param shareholderAddress shareholder withdrawing funds
   * @param value value being withdrawn
   */
  event Withdraw(address indexed shareholderAddress, uint256 value);

  /**
   * @dev Fired in forceWithdraw function
   *
   * @param owner address of current owner withdrawing funds
   * @param shareholderAddress address of shareholder from which owner is withdrawing funds
   * @param value value being withdrawn from shareholder by owner
   */
  event ForceWithdraw(address indexed owner, address indexed shareholderAddress, uint256 value);

  /**
   * @dev Fired in dangerousForceWithdraw function
   *
   * @param owner address of current owner withdrawing funds
   * @param value value being withdrawn from contract
   */
  event DangerousForceWithdraw(address indexed owner, uint256 value);

  /**
   * @dev Deploys the DAO smart contract,
   *      assigns initial shareholders
   *
   * Emits a {ShareholdersChanged} event
   *
   * @param _shareholders initial shareholders
   * @param _shareholderOwnership initial shareholder ownership
   */
  function initialize(address[] memory _shareholders, uint256[] memory _shareholderOwnership) public initializer {
    OwnableUpgradeable.__Ownable_init();
    changeShareholders(_shareholders, _shareholderOwnership);
  }
  /**
   * @dev Automatically distribute funds to shareholders
   *      on receival. It is recommended the distributeToShareholders()
   *      is used as this may run out of gas when called via `.transfer()`
   */
  receive() external payable {
    distributeToShareholders();
  }

  /**
   * @dev Automatically distribute funds to shareholders
   *      on receival. It is recommended the distributeToShareholders()
   *      is used as this may run out of gas when called via `.transfer()`
   */
  fallback() external payable {
    distributeToShareholders();
  }

  /**
   * @dev Allows a shareholder to withdraw funds from his balance
   *
   * Emits a {Withdraw} event
   *
   * @param _amount amount to withdraw - must be lte shareholder balance
   */
  function withdraw(uint256 _amount) external nonReentrant onlyIfShareholderHasBalance(msg.sender, _amount) {
    shareholderBalance[msg.sender] -= _amount;
    (bool success, ) = payable(msg.sender).call{value: _amount}("");
    require(success, "can not withdraw");

    emit Withdraw(msg.sender, _amount);
  }

  /**
   * @dev Allows the DAO owner to forcefully withdraw shareholder funds from the DAO
   *
   * Emits a {ForceWithdraw} event
   *
   * @param _addr shareholder address to withdraw funds from
   * @param _amount amount to withdraw - must be lte _addr shareholder balance
   */
  function forceWithdraw(address _addr, uint256 _amount) external onlyOwner nonReentrant onlyIfShareholderHasBalance(_addr, _amount) {
    shareholderBalance[_addr] -= _amount;

    (bool success, ) = payable(msg.sender).call{value: _amount}("");
    require(success, "can not withdraw");

    emit ForceWithdraw(owner(), _addr, _amount);
  }

  /**
   * @dev Allows the DAO owner to forcefully withdraw funds from the contract
   *
   * @dev Will leave the contract in an unusable state as it does not update
   *      shareholder balances
   *
   * Emits a {DangerousForceWithdraw} event
   *
   * @param _amount amount to withdraw from contract
   */
  function dangerousForceWithdraw(uint256 _amount) external onlyOwner nonReentrant {
    (bool success, ) = payable(msg.sender).call{value: _amount}("");
    require(success, "can not withdraw");

    emit DangerousForceWithdraw(owner(), _amount);
  }

  /**
   * @notice Changes DAO shareholders
   *
   * @dev Restricted function only used by contract owner
   *
   * @dev Shareholder ownership must add up to 100.000(100%)
   *
   * Emits a {ShareholdersChanged} event
   *
   * @param _shareholders new shareholders
   * @param _shareholderOwnership new shareholder ownership
   */
  function changeShareholders(address[] memory _shareholders, uint256[] memory _shareholderOwnership) public onlyOwner {
    // Length of _shareholders must match length of _shareholderOwnership
    require(_shareholders.length == _shareholderOwnership.length, "incompatible array length");

    // Must include at least one shareholder
    require(_shareholders.length > 0, "no shareholders");

    // Calculate sum of ownerships
    uint256 sum = 0;

    for(uint16 i = 0; i < _shareholderOwnership.length; i++) {
      // Zero address cannot be a shareholder
      require(_shareholders[i] != address(0), "zero address not accepted");

      sum += _shareholderOwnership[i];
    }

    // Ensure ownership matches 100.000 (100%)
    require(sum == 100_000, "ownership must sum to 100000");
   
    // Update shareholder addresses & ownership
    shareholders = _shareholders;
    shareholderOwnership = _shareholderOwnership;

     // Emit event
    emit ShareholdersChanged(
      shareholders,
      shareholderOwnership,
      _shareholders,
      _shareholderOwnership
    );

  }

  /**
   * @dev Distributes sent ether funds to shareholders proportional to their ownership
   *
   * Emits a {Payout} event
   */
  function distributeToShareholders() public payable {
    for(uint i = 0; i < shareholders.length; i++) {
      shareholderBalance[shareholders[i]] += msg.value * shareholderOwnership[i] / 100_000;
    }

    emit Payout(shareholders, shareholderOwnership, msg.value);
  }

  /**
   * @dev Distributes sent ether funds to shareholders proportional to their ownership
   *
   * Emits a {Payout} event
   */
  function distributeToShareholdersExactAmount(uint256 _amount) public payable {
    for(uint16 i = 0; i < shareholders.length; i++) {
      shareholderBalance[shareholders[i]] += _amount * shareholderOwnership[i] / 100_000;
    }

    emit Payout(shareholders, shareholderOwnership, _amount);
  }

}
