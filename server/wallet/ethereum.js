const ethers = require('ethers')
const solc = require('solc')
const private_key = require('../database/private_key.js')

module.exports = {
	address: (_swap) => {
        return '0xe0578E4fd431e57B38C7bCD72036629f803df515'
    },

	pay: async (_swap) => {
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
			contractAddress = await getContractAddress(transaction.hash)
		}
		resolve(contractAddress)
	},

	spend: async (_swap) => {
		// https://docs.ethers.io/ethers.js/html/api-contract.html#examples
        const seconds = 60

		const provider = ethers.providers.getDefaultProvider('rinkeby')
		console.log('\n\nprovider', provider)
		const wallet = new ethers.Wallet(private_key.ethereum, provider)		
		console.log('\n\nwallet', wallet)
		const input = `pragma solidity ^0.4.0; contract HTLC { uint public lockTime = ${seconds} seconds; address public toAddress = ${_swap.buyerAddress1}; bytes32 public hash = 0x${_swap.hash}; uint public startTime = now; address public fromAddress; string public key; uint public fromValue; function HTLC() payable { fromAddress = msg.sender; fromValue = msg.value; } modifier condition(bool _condition) { require(_condition); _; } function checkKey(string _key) payable condition ( sha256(_key) == hash ) returns (string) { toAddress.transfer(fromValue); key = _key; return key; } function withdraw () payable condition ( startTime + lockTime < now ) returns (uint) { fromAddress.transfer(fromValue); return fromValue; } }`
		const output = solc.compile(input, 1)

		let abi
		for (const contractName in output.contracts) {
		   	abi = JSON.parse(output.contracts[contractName].interface)
		}

		const contract = new ethers.Contract(_swap.transaction1, abi, wallet)
		console.log('\n\ncontract', contract)
		const sendPromise = await contract.checkKey(_swap.key)
		console.log('sendPromise', sendPromise)
		return sendPromise.hash
	},

	redeem: async () => {
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

		return sendPromise.hash
	}
}

async function getContractAddress(addressHash) {
	try {
		const data = await $.get(`https://api-rinkeby.etherscan.io/api?module=proxy&action=eth_getTransactionReceipt&txhash=${addressHash}`)
		return data.result.contractAddress
	} catch (e) {
		return undefined
	}
}