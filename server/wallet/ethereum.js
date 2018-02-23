const ethers = require('ethers')
const solc = require('solc')

module.exports = {
	address: (_swap) => {
        return '0x5873E7b7F909B4F76ce4B7B3338DB674F1aC3a02'
    },

	pay: async (_swap) => {
        const seconds = 60

		const provider = ethers.providers.getDefaultProvider('rinkeby');
		const wallet = new ethers.Wallet(privateKey.ethereum, provider)	

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
		console.log('rawTransaction', rawTransaction)

		const transaction = await wallet.sendTransaction({
			data: rawTransaction.data,
			value: ethers.utils.parseEther(_swap.amount2.toString())
		})
		
		return transaction.hash
	},

	spend: async (_swap) => {
		// https://docs.ethers.io/ethers.js/html/api-contract.html#examples
        const seconds = 60

		const provider = ethers.providers.getDefaultProvider('rinkeby');
		const wallet = new ethers.Wallet(privateKey.ethereum, provider)		

		const input = `pragma solidity ^0.4.0; contract HTLC { uint public lockTime = ${seconds} seconds; address public toAddress = ${_swap.buyerAddress1}; bytes32 public hash = 0x${_swap.hash}; uint public startTime = now; address public fromAddress; string public key; uint public fromValue; function HTLC() payable { fromAddress = msg.sender; fromValue = msg.value; } modifier condition(bool _condition) { require(_condition); _; } function checkKey(string _key) payable condition ( sha256(_key) == hash ) returns (string) { toAddress.transfer(fromValue); key = _key; return key; } function withdraw () payable condition ( startTime + lockTime < now ) returns (uint) { fromAddress.transfer(fromValue); return fromValue; } }`
		const output = solc.compile(input, 1)

		let abi

		for (const contractName in output.contracts) {
		   	abi = JSON.parse(output.contracts[contractName].interface)
		}

		const contract = new ethers.Contract(_swap.transaction1, abi, wallet)
		const sendPromise = await contract.myFunction(_swap.key);
		return sendPromise.hash
	},

	redeem: async () => {
		// https://docs.ethers.io/ethers.js/html/api-contract.html#examples
        const seconds = 60

        const provider = ethers.providers.getDefaultProvider('rinkeby');
		const wallet = new ethers.Wallet(privateKey.ethereum, provider)	

		const privateKey = '0x90ce4c3b2cbe150f941a07e50ea81426c71162f083651db362878d04b348ee06'
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