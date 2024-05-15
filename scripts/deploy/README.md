# Deployment Script

## Config
Deployment script requires a Javascript configuration file to run. An error will be thrown if none is provided.

By default, the config file must be in the same directory as the `deploy.js` script and be named `config.js`.
It must also export an object like this:
```js
module.exports = {
  // REQUIRED: The address to deploy the contracts from.
  // web3Accounts is a array of strings including the accounts from web3.eth.getAccounts
  // Must return either a string or a promise to a string
  deployerAddress: (web3Accounts) => '0x...',
  
  // OPTIONAL: Global context to be used in contracts[].constructorArguments
  context: {
    magicNumber: 42
  },
  
  // REQUIRED: Each key of this object represents a contract name to be deployed
  // Contract artifacts must be available for every key of this object and will be
  // received through artifacts.require. E.g. artifacts.require('NFTMarketplace').
  //
  // The script will automatically compile all contracts through Hardhat so there's
  // no need to do that manually.
  contracts: {
    // This will deploy the NFT contract
    NFT: {
      // OPTIONAL: This function computes the constructor arguments of the contract
      // It takes one object as its sole argument that contains 4 properties:
      // web3 - Web3 instance
      // deployerAddress - The address of the account deploying the contract
      // context - The context object
      // contracts - An object containing the currently deployed contracts
      // It must return an array or a promise to an array - the constructor arguments for this contract
      constructorArguments({ context }) {
        return [context.magicNumber]
      },
      
      // OPTIONAL: An array of string contract properties - will be logged
      // to the console after successful deployment of this contract
      displayProperties: [
        'name',
        'symbol'
      ]
    },

    NFTMarketplace: {
      // OPTIONAL: An array of strings - other contracts this
      // contract depends on
      dependsOn: [
        'NFT'
      ],
      
      // OPTIONAL: This function computes the constructor arguments of the contract
      // It takes one object as its sole argument that contains 4 properties:
      // web3 - Web3 instance
      // deployerAddress - The address of the account deploying the contract
      // context - The context object
      // contracts - An object containing the currently deployed contracts
      // It must return an array or a promise to an array - the constructor arguments for this contract
      constructorArguments({ contracts, deployerAddress }) {
        return [
          deployerAddress,
          contracts['NFT'].address
        ]
      },
      
      // OPTIONAL: Function to be called after deployment is completed and
      // properties are logged.
      // It takes one object as its sole argument that contains 4 properties:
      // web3 - Web3 instance
      // deployerAddress - The address of the account deploying the contract
      // context - The context object
      // contracts - An object containing the currently deployed contracts
      // It can either return a promise or not
      async afterDeploy({ web3, deployerAddress }) {
        console.log(
          'Deployer address transaction count after NFT Marketplace deployment:',
          web3.eth.getTransactionCount(deployerAddress)
        )
      }
    }
  }
}
```

## Continuing Interrupted Deployment
If the deployment process is interrupted, a temp JSON file will be seen(by default named `.temp.json` and stored in the
 same directory as the `deploy.js` script).

If the deployment process is then reran, there will be a prompt to continue from the progress of the last, interrupted deployment.

## Extending the Successful Deployment
There is an option to save the deployment information into the file. The file can be used by another deployment to
continue from where it ended.

### Run
The deployment script should be run via node:
```
node scripts/v2/deploy.js
```
Pass an `-h` argument to the script in order to get help:
```
> node scripts/v2/deploy.js --help                                                                                                                                                                 ─╯

Deploy script

  Deploys contracts to an Ethereum network 

Options

  -c, --configPath string             Path of config file                   
  -t, --tempPath string               Path of temp file                     
  -d, --deploymentFolderPath string   Path of deployments folder            
  -n, --network string                Network to deploy to                  
  -s, --save                          Save to deployment file after success 
  --continueDeploymentPath string     Path of deploy file to continue from  
  -h, --help                          Get help     
```
