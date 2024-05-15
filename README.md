#  Contracts fot NFT(ERC 720) with minting tiers and stacking with upgradable DAO

The contracts are used to mint, stake VIP cards

## Deployment

For the deployment, the example scripts `scripts/deploy/deploy.js` and `scripts/deploy/deployProxy.js` are provided.

## Usage

### Minting

#### Tiers
Tiers are created for whitelisting addresses for exact price of cards. There are also wildcard whitelists, which suppose anyone can mint the card. 

### Staking
All card holders can stake them. There are minimum days of staking before the cards can be withdrawn.

## Testing

```
npx hardhat test
```

