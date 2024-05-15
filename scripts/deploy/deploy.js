const {cli} = require('cli-ux');
const topoSort = require('toposort');
const timeAgo = require('time-ago');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage')

const path = require('path');
const fs = require('fs');

const calculateNextContractAddress = require('./utils/calculateNextContractAddress');
const addressIsContract = require('./utils/addressIsContract');
const sleep = require('./utils/sleep');

const defaultConfigPath = path.join(__dirname, 'config.js');
const defaultTempPath = path.join(__dirname, '.temp.json');
const defaultDeploymentFolderPath = path.join(__dirname, 'deployments');

function changeTemp(newTemp) {
	fs.writeFileSync(tempPath, JSON.stringify(newTemp), {encoding: 'utf-8'});
}

function getTemp() {
	return JSON.parse(fs.readFileSync(tempPath, {encoding: 'utf-8'}));
}

const cliCommands = [
	{name: 'configPath', alias: 'c', type: String, defaultValue: defaultConfigPath, description: 'config file path'},
	{name: 'tempPath', alias: 't', type: String, defaultValue: defaultTempPath, description: 'temp file path'},
	{
		name: 'deploymentFolderPath',
		alias: 'd',
		type: String,
		defaultValue: defaultDeploymentFolderPath,
		description: 'deployments folder path'
	},
	{
		name: 'network',
		alias: 'n',
		type: String,
		defaultValue: null,
		description: 'network to deploy into (e.g. localhost, hardhat)'
	},
	{name: 'save', alias: 's', type: Boolean, defaultValue: true, description: 'save the deployment file after success'},
	{
		name: 'continueDeploymentPath',
		alias: 'p',
		type: String,
		defaultValue: '',
		description: 'deployment file path to continue from'
	},
	{name: 'help', alias: 'h', type: Boolean, defaultValue: false, description: 'display help'}
];

const {
	configPath,
	tempPath,
	deploymentFolderPath,
	network: argNetwork,
	save,
	continueDeploymentPath,
	help
} = commandLineArgs(cliCommands);

const cliUsage = commandLineUsage([
	{
		header: 'Alethea Deployment Script',
		content: 'Deploys Alethea protocol smart contracts to an Ethereum network'
	},
	{
		header: 'Options',
		optionList: cliCommands
	}
]);
if(help) {
	console.log(cliUsage);
	process.exit(0);
}


const continueDeployment = continueDeploymentPath && JSON.parse(fs.readFileSync(
	path.join(__dirname, continueDeploymentPath),
	'utf-8'
));

argNetwork && (process.env.HARDHAT_NETWORK = argNetwork);

const hardhat = require('hardhat');
const {web3, artifacts, network, upgrades} = hardhat;

let progressBar, deployerAddress;

const deployedContracts = {};
const deployedContractConstructorArguments = {};

(async() => {
	await hardhat.run('compile');

	if(!fs.existsSync(configPath)) {
		console.error('ERROR: Config file not found');
		process.exit(1);
	}

	const config = require(configPath);

	if(!config.contracts) {
		console.error('ERROR: No contracts defined in the config');
		process.exit(1);
	}

	config.context ||= {};

	console.log(`Starting the deployment into the "${network.name}" network...`);
	console.log();

    const contractNames = Object.keys(config.contracts);
    
	const orderedContractNames = topoSort.array(
		contractNames,
		contractNames.flatMap(contractName => {
			const contractConfig = config.contracts[contractName];

			if(!contractConfig.dependsOn?.length) {
				return [];
			}

			return config.contracts[contractName].dependsOn.map(
				dependencyContractName => [contractName, dependencyContractName]
			)
		})
	).reverse();

	console.log('Deploying contracts in the following order:');
	orderedContractNames.forEach((contractName, i) => console.log(`${i + 1}) ${contractName}`));
	console.log();

	const orderedContracts = orderedContractNames.map(
		contractName => artifacts.require(contractName)
	);

	deployerAddress = await Promise.resolve(config.deployerAddress?.(await web3.eth.getAccounts()));

	if(!deployerAddress) {
		console.error('ERROR: No deployer address defined in the config');
		process.exit(1);
	}

	const nonce = await web3.eth.getTransactionCount(deployerAddress);
	const balance = web3.utils.fromWei(await web3.eth.getBalance(deployerAddress), 'ether');
	console.log("deployer account: %o; nonce: %o; balance: %o ETH", deployerAddress, nonce, balance);

	progressBar = cli.progress({
		format: 'PROGRESS | {bar} | {value}/{total} Contracts\n',
		barCompleteChar: '\u2588',
		barIncompleteChar: '\u2591',
		hideCursor: true
	});

	let i = 0;

	async function loadContractsFromObject(obj, name) {
		for(; i < orderedContracts.length; i++) {
			const objContractAddress = obj[orderedContractNames[i]];

			if(!config.contracts[orderedContractNames[i]]) {
				console.error(`ERROR: Contract ${orderedContractNames[i]} exists on ${name} file but not on config file`);
				process.exit(1);
			}

			if(objContractAddress && await addressIsContract(web3, objContractAddress)) {
				const deployedContract = deployedContracts[orderedContractNames[i]] = await orderedContracts[i].at(objContractAddress);

				const configContract = config.contracts[orderedContractNames[i]];

				console.log();
				if(!configContract.displayProperties) {
					console.log(`Contract ${orderedContractNames[i]} has already been deployed at address ${objContractAddress}`);
				}
				else {
					console.log(`Contract ${orderedContractNames[i]} has already been deployed at address ${objContractAddress} with properties:`);

					const maxPropertyLength = Math.max(
						...configContract.displayProperties.map(property => property.length)
					);

					for(let i = 0; i < configContract.displayProperties.length; i++) {
						const property = configContract.displayProperties[i];
						if(deployedContract[property]) {
							const value = (await deployedContract[property]()).toString();
							console.log(`${property}:`.padEnd(maxPropertyLength + 3) + value);
						}
						else {
							console.warn("function %o not found for contract %o", property, orderedContractNames[i]);
						}
					}
				}
			}
			else {
				break;
			}
		}
	}

	if(!fs.existsSync(tempPath)) {
		if(!continueDeployment) {
			changeTemp({time: +Date.now()});
		}
		else {
			const {network, deployerAddress, time, ...deployedContracts} = continueDeployment;

			console.log();
			console.log(`Continuing deployment from ${continueDeployment.network}-${continueDeployment.time}...`);

			await loadContractsFromObject(deployedContracts, 'deploy');

			changeTemp({
				time: +Date.now(),
				continueDeployment: `${continueDeployment.network}-${continueDeployment.time}`
			});
		}
	}
	else {
		console.log();
		const continueProgress = await cli.confirm(`It appears that the last deployment routine execution ${timeAgo.ago(getTemp().time)} was interrupted. Do you wish to continue it?`);

		if(continueProgress) {
			console.log();
			console.log('Continuing progress from the previous attempt...');
			const temp = getTemp();

			if(temp.continueDeployment && !continueDeployment) {
				console.error(`ERROR: Last deployment routine used previous deployment ${temp.continueDeployment} but now trying to run without a previous deployment`)
				console.error(`Please provide the correct previous deployment to be able to continue`);
				process.exit(1);
			}

			if(!temp.continueDeployment && continueDeployment) {
				console.error(`ERROR: Last deployment routine did not use previous deployment but now trying to run with previous deployment ${continueDeployment.network}-${continueDeployment.time}`)
				console.error(`Please do not use the previous deployment to be able to continue`);
				process.exit(1);
			}

			if(temp.continueDeployment || continueDeployment) {
				const currentContinueDeployment = `${continueDeployment.network}-${continueDeployment.time}`;
				if(temp.continueDeployment != currentContinueDeployment) {
					console.error(`ERROR: Last deployment routine used previous deployment ${temp.continueDeployment} but now trying to run with previous deployment ${currentContinueDeployment}`)
					console.error(`Please provide the correct previous deployment to be able to continue`);
					process.exit(1);
				}
			}

			await loadContractsFromObject(temp, 'temp');
		}
		else {
			if(!continueDeployment) {
				changeTemp({time: +Date.now()})
			}
			else {
				const {network, deployerAddress, time, ...deployedContracts} = continueDeployment;

				console.log();
				console.log(`Continuing deployment from ${continueDeployment.network}-${continueDeployment.time}...`);

				await loadContractsFromObject(deployedContracts, 'deploy');

				changeTemp({
					time: +Date.now(),
					continueDeployment: `${continueDeployment.network}-${continueDeployment.time}`,
				});
			}
		}
	}

	progressBar.start(orderedContractNames.length, i);

	for(; i < orderedContracts.length; i++) {
		console.log()
		const contract = orderedContracts[i];
		const contractName = orderedContractNames[i];

		const configContract = config.contracts[contractName];

		const expectedContractAddress = await calculateNextContractAddress(web3, deployerAddress);

		console.log(`Deploying ${contractName} to ${expectedContractAddress}`)

		changeTemp(
			Object.assign(
				getTemp(),
				{
					[contractName]: expectedContractAddress
				}
			)
		);

		configContract.constructorArguments ||= () => [];

		const constructorArguments = await Promise.resolve(
			configContract.constructorArguments({
				web3,
				deployerAddress: deployerAddress,
				contracts: deployedContracts,
				context: config.context
			})
		);
		
		const deployedContract = await contract.new(...constructorArguments, {from: deployerAddress, ...(configContract.value && { value: configContract.value })});

		deployedContracts[contractName] = deployedContract;
		deployedContractConstructorArguments[contractName] = constructorArguments;
		console.log("deployedContractConstructorArguments", deployedContractConstructorArguments);
		if(!configContract.displayProperties) {
			console.log(`Deployed contract ${contractName} at address ${deployedContract.address}`);
		}
		else {
			console.log(`Deployed contract ${contractName} at address ${deployedContract.address} with properties:`);

			const maxPropertyLength = Math.max(
				...configContract.displayProperties.map(property => property.length)
			);

			for(let i = 0; i < configContract.displayProperties.length; i++) {
				const property = configContract.displayProperties[i];
				if(deployedContract[property]) {
					const value = (await deployedContract[property]()).toString();
					console.log(`${property}:`.padEnd(maxPropertyLength + 3) + value);
				}
				else {
					console.warn("function %o not found for contract %o", property, orderedContractNames[i]);
				}
			}
		}

		configContract.afterDeploy && await Promise.resolve(configContract.afterDeploy({
			web3,
			contracts: deployedContracts,
			deployerAddress,
			context: config.context
		}));

		progressBar.increment();
	}
})().then(async() => {
	progressBar.stop();

	if(!['hardhat', 'localhost'].includes(network.name)) {
		cli.action.start(`Waiting 2 minutes for contract deployments to propagate on Etherscan`);
		await sleep(2 * 60 * 1000 /* 2 minutes */);
		cli.action.stop();

		const etherscanVerifications = []

		for(let contractName in deployedContracts) {
			const address = deployedContracts[contractName].address;
			const constructorArguments = deployedContractConstructorArguments[contractName];
			console.log ("address",address);
			console.log ("constructorArguments",constructorArguments);
			etherscanVerifications.push(
				hardhat.run('verify:verify', {
					address,
					constructorArguments
				})
			);
		}

		cli.action.start(`Waiting for Etherscan verifications to complete`);
		await Promise.all(etherscanVerifications);
		cli.action.stop();
	}

	if(save) {
		const deploymentFileName = `partner-${network.name}-${+Date.now()}.json`;

		const deploymentFilePath = path.join(deploymentFolderPath, deploymentFileName);

		if(!fs.existsSync(deploymentFolderPath)) {
			fs.mkdirSync(deploymentFolderPath);
		}

		fs.writeFileSync(deploymentFilePath, JSON.stringify({
			network: network.name,
			deployerAddress,
			...getTemp(),
			...(continueDeployment && {previous: continueDeployment})
		}, null, 2), 'utf-8');
	}

	fs.unlinkSync(tempPath);

	console.log('Deployment routine finished successfully!')
});

