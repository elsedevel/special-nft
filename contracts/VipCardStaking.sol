// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @notice DaoInterface interface for getting staking info from dao
 */
interface DaoInterface {
	function getStakeHolderReward(address) external view returns (uint256);
	function sendReward(address) external;
}

contract VipCardStaking is ReentrancyGuard, Ownable {
	IERC721 public immutable nftCollection;

   /**
   * @notice Staked Token struct
   * stores information about the person who staked, the card is being staked, and the date of staking
   */
	struct StakedToken {
		address staker;
		uint256 tokenId;
		uint256 stakingDate;
	}

   /**
   * @notice Staker struct
   * stores information about the staked tokens and total amount staked
   */
	struct Staker {
		uint256 amountStaked;
		StakedToken[] stakedTokens;
	}

   /**
   * @notice Mapping of User Address to Staker info
   */
	mapping(address => Staker) public stakers;

   /**
   * @notice Mapping of Token Id to staker. Made for the SC to remember who to send back the ERC721 Token to.
   */
	mapping(uint256 => address) public stakerAddress;

   /**
   * @notice Array of the addresses who stake some token
   */
	address [] public stakingAddresses;

	/**
   * @notice require minimum amount of days to be staked before withdrawal
   */
	uint32 public minDaysOfStaking = 30;

	/**
* @notice amount of total staked cards
   */
	uint256 public totalStaked = 0;

	/**
* @notice The address of dao
   */
	address private daoAddress;

	/**
 * @dev Fired in stake()
   *
   * @param staker person who staked
   * @param tokenId vip card
   */
	event VipCardStaked(address staker, uint256 tokenId);

	/**
 * @dev Fired in withdraw()
   *
   * @param staker person who withdraw the card
   * @param tokenId vip card
   */
	event VipCardWithdrawn(address staker, uint256 tokenId);

	/**
 * @dev Fired in claimRewards()
   *
   * @param staker person who claims the rewards
   * @param amount reward
   */
	event RewardsClaimed(address staker, uint256 amount);

	/**
* @dev Fired in setMinDaysOfStaking()
   *
   * @param daysCount amount of days
   */
	event StakingMinDaysSet(uint32 daysCount);
	/**

* @dev Fired in changeDaoAddress()
   *
   * @param daoAddress address of dao
   */
	event DaoAddressChanged(address daoAddress);

	constructor(IERC721 _nftCollection, address _daoAddress) {
		nftCollection = _nftCollection;
		daoAddress = _daoAddress;
	}

	/**
   * @dev Stake function
   *
   * Emits a {VipCardStaked} event
   *
   * @param _tokenId the id of the vip card
   */
	function stake(uint256 _tokenId) external nonReentrant {
		require(
			nftCollection.ownerOf(_tokenId) == msg.sender,
			"You don't own this token!"
		);

		nftCollection.transferFrom(msg.sender, address(this), _tokenId);
		StakedToken memory stakedToken = StakedToken(msg.sender, _tokenId, block.timestamp);

		stakers[msg.sender].stakedTokens.push(stakedToken);
		stakers[msg.sender].amountStaked++;

		if (stakers[msg.sender].amountStaked == 1) {
			stakingAddresses.push(msg.sender);
		}

		totalStaked++;
		stakerAddress[_tokenId] = msg.sender;

		emit VipCardStaked(msg.sender, _tokenId);
	}

	/**
   * @dev Withdraw staked vip card function
   *
   * Emits a {VipCardWithdrawn} event
   *
   * @param _tokenId the id of the vip card
   */
	function withdraw(uint256 _tokenId) external nonReentrant {
		require(
			stakers[msg.sender].amountStaked > 0,
			"You have no tokens staked"
		);

		require(stakerAddress[_tokenId] == msg.sender, "You don't own this token!");

		uint256 nftIndex = 0;
		for (uint256 i = 0; i < stakers[msg.sender].stakedTokens.length; i++) {
			if (stakers[msg.sender].stakedTokens[i].tokenId == _tokenId) {
				nftIndex = i;
				break;
			}
		}

		uint256 allowedWithdrawalDate = stakers[msg.sender].stakedTokens[nftIndex].stakingDate + minDaysOfStaking * 24 * 60 * 60;

		require(allowedWithdrawalDate <= block.timestamp, "You can not withdraw the nft yet");

		stakers[msg.sender].stakedTokens[nftIndex].staker = address(0);

		stakers[msg.sender].amountStaked--;

		if(stakers[msg.sender].amountStaked == 0) {
			uint256 stakerIndex = 0;
			for (uint256 i = 0; i < stakingAddresses.length; i++) {
				if (msg.sender == stakingAddresses[stakerIndex]) {
					stakingAddresses[stakerIndex] = address(0);
					break;
				}
			}
		}

		totalStaked--;

		stakerAddress[_tokenId] = address(0);

		nftCollection.transferFrom(address(this), msg.sender, _tokenId);

		emit VipCardWithdrawn(msg.sender, _tokenId);
	}

	/**
   * @dev Get the rewards for staked vip cards
   *
   * Emits a {RewardsClaimed} event
   *
   */
	function claimRewards() external nonReentrant {
		uint256 reward = DaoInterface(daoAddress).getStakeHolderReward(msg.sender);

		require(reward > 0, "You have no rewards to claim");
		DaoInterface(daoAddress).sendReward(msg.sender);

		emit RewardsClaimed(msg.sender, reward);
	}

	/**
* @dev Get available rewards for current user
   */
	function availableRewards() external view returns (uint256) {
		return DaoInterface(daoAddress).getStakeHolderReward(msg.sender);
	}

	/**
* @dev Get the tokens staked per user
   * @param _user the staker address
   */
	function getStakedTokens(address _user) external view returns (StakedToken[] memory) {
		if (stakers[_user].amountStaked > 0) {
			StakedToken[] memory _stakedTokens = new StakedToken[](stakers[_user].amountStaked);
			uint256 _index = 0;

			for (uint256 j = 0; j < stakers[_user].stakedTokens.length; j++) {
				if (stakers[_user].stakedTokens[j].staker != (address(0))) {
					_stakedTokens[_index] = stakers[_user].stakedTokens[j];
					_index++;
				}
			}

			return _stakedTokens;
		} else {
			return new StakedToken[](0);
		}
	}

	/**
* @dev Change min days of staking param
   * @param _days new min days amount
   */
	function setMinDaysOfStaking(uint32 _days) external onlyOwner {
		require(_days > 0, "should be minimum 1 day");
		minDaysOfStaking = _days;
		emit StakingMinDaysSet(_days);
	}

	/**
* @dev Get the length of staking addresses
   */
	function getStakingAddressesCount() external view returns (uint256) {
		return stakingAddresses.length;
	}

	/**
* @dev Change dao address
   * @param _newDaoAddress the new address of dao
   */
	function changeDaoAddress(address _newDaoAddress) external onlyOwner {
		require(_newDaoAddress != address(0), "address can not be empty");
		daoAddress = _newDaoAddress;
		emit DaoAddressChanged(daoAddress);
	}
}