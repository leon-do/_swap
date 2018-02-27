const request = require('request')
const ethers = require('ethers')
const solc = require('solc')
const private_key = require('../database/private_key.js')

module.exports = {
	address: (_swap) => {
        return '0xe0578E4fd431e57B38C7bCD72036629f803df515'
    },

	pay: async (_swap) => {
		console.log('wallet/ethereum.js::pay()')
        const seconds = 60

		const provider = ethers.providers.getDefaultProvider('rinkeby');
		const wallet = new ethers.Wallet(private_key.ethereum, provider)	

		const input = `pragma solidity ^0.4.0; contract HTLC { uint public lockTime = ${seconds} seconds; address public toAddress = ${_swap.buyerAddress2}; bytes32 public hash = 0x${_swap.hash}; uint public startTime = now; address public fromAddress; string public key; uint public fromValue; function HTLC() payable { fromAddress = msg.sender; fromValue = msg.value; } modifier condition(bool _condition) { require(_condition); _; } function checkKey(string _key) payable condition ( sha256(_key) == hash ) returns (string) { toAddress.transfer(fromValue); key = _key; return key; } function withdraw () payable condition ( startTime + lockTime < now ) returns (uint) { fromAddress.transfer(fromValue); return fromValue; } }`
		const output = solc.compile(input, 1)

		let bytecode
		let abi
		for (const contractName in output.contracts) {
		    bytecode = output.contracts[contractName].bytecode
		   	abi = JSON.parse(output.contracts[contractName].interface)
		}
		bytecode = '0x' + bytecode

		const rawTransaction = ethers.Contract.getDeployTransaction(bytecode, abi)

		const transaction = await wallet.sendTransaction({
			data: rawTransaction.data,
			value: ethers.utils.parseEther(_swap.amount2.toString())
		})
		
		let contractAddress
		while (contractAddress === undefined) {
			await pause(5000)
			console.log('waiting for contract address...')
			contractAddress = await getContractAddress(transaction.hash)
		}
		console.log('wallet/ethereum.js::pay()::contractAddress =', contractAddress)
		return contractAddress
	},

	spend: async (_swap) => {
		console.log('wallet/ethereum.js::spend()')

		// https://docs.ethers.io/ethers.js/html/api-contract.html#examples
        const seconds = 60

		const provider = ethers.providers.getDefaultProvider('rinkeby')
		const wallet = new ethers.Wallet(private_key.ethereum, provider)		
		const input = `pragma solidity ^0.4.0; contract HTLC { uint public lockTime = ${seconds} seconds; address public toAddress = ${_swap.buyerAddress1}; bytes32 public hash = 0x${_swap.hash}; uint public startTime = now; address public fromAddress; string public key; uint public fromValue; function HTLC() payable { fromAddress = msg.sender; fromValue = msg.value; } modifier condition(bool _condition) { require(_condition); _; } function checkKey(string _key) payable condition ( sha256(_key) == hash ) returns (string) { toAddress.transfer(fromValue); key = _key; return key; } function withdraw () payable condition ( startTime + lockTime < now ) returns (uint) { fromAddress.transfer(fromValue); return fromValue; } }`
		const output = solc.compile(input, 1)

		let abi
		for (const contractName in output.contracts) {
		   	abi = JSON.parse(output.contracts[contractName].interface)
		}

		const contract = new ethers.Contract(_swap.transaction1, abi, wallet)
		const sendPromise = await contract.checkKey(_swap.key)
		console.log('wallet/ethereum.js::spend() sendPromise.hash', sendPromise.hash)
		return sendPromise.hash
	},

	redeem: async () => {
		console.log('wallet/ethereum.js::redeem()')

		// https://docs.ethers.io/ethers.js/html/api-contract.html#examples
        const seconds = 60

        const provider = ethers.providers.getDefaultProvider('rinkeby');
		const wallet = new ethers.Wallet(private_key.ethereum, provider)	

		const input = `pragma solidity ^0.4.0; contract HTLC { uint public lockTime = ${seconds} seconds; address public toAddress = ${_swap.buyerAddress2}; bytes32 public hash = 0x${_swap.hash}; uint public startTime = now; address public fromAddress; string public key; uint public fromValue; function HTLC() payable { fromAddress = msg.sender; fromValue = msg.value; } modifier condition(bool _condition) { require(_condition); _; } function checkKey(string _key) payable condition ( sha256(_key) == hash ) returns (string) { toAddress.transfer(fromValue); key = _key; return key; } function withdraw () payable condition ( startTime + lockTime < now ) returns (uint) { fromAddress.transfer(fromValue); return fromValue; } }`
		const output = solc.compile(input, 1)

		let abi
		for (const contractName in output.contracts) {
		   	abi = JSON.parse(output.contracts[contractName].interface)
		}

		const contract = new ethers.Contract(_swap.transaction1, abi, wallet);

		const sendPromise = await contract.withdraw();

		console.log('wallet/ethereum.js::redeem()::sendPromise.hash', sendPromise.hash)
		return sendPromise.hash
	}
}

async function getContractAddress(addressHash) {
	return new Promise ((resolve, reject) => {
		request(`https://api-rinkeby.etherscan.io/api?module=proxy&action=eth_getTransactionReceipt&txhash=${addressHash}`, (err, res, body) => {
	        try {
	        	const data = JSON.parse(body)
	        	resolve(data.result.contractAddress)
	        } catch (e) {
	        	resolve(undefined)
	        }
		})
	})
}


function pause(milliseconds){
	return new Promise(resolve => {
		setTimeout(function(){ 
			resolve(true)
		}, milliseconds)
	})
}