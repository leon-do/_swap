const ethereum = {
	address: (_swap) => {
		return '0x5873E7b7F909B4F76ce4B7B3338DB674F1aC3a02'
	},

	pay: (_swap) => {

		return new Promise((resolve, reject) => {
			const privateKey = '0x505bdbc30b8f84d06dbfb4c780a5504c87a2a13731f11c41c0f9b4247b719985'
	    	const provider = ethers.providers.getDefaultProvider('rinkeby');
			const wallet = new ethers.Wallet(privateKey, provider)
			const timeLock = 60

			// solidity code
			const contract = `pragma solidity ^0.4.0; contract HTLC { uint public lockTime = ${timeLock} seconds; address public toAddress = ${_swap.sellerAddress1}; bytes32 public hash = 0x${_swap.hash}; uint public startTime = now; address public fromAddress; string public key; uint public fromValue; function HTLC() payable { fromAddress = msg.sender; fromValue = msg.value; } modifier condition(bool _condition) { require(_condition); _; } function checkKey(string _key) payable condition ( sha256(_key) == hash ) returns (string) { toAddress.transfer(fromValue); key = _key; return key; } function withdraw () payable condition ( startTime + lockTime < now ) returns (uint) { fromAddress.transfer(fromValue); return fromValue; } }`

			// load compiler
			BrowserSolc.loadVersion("soljson-v0.4.20+commit.3155dd80.js", async (compiler) => {
				const result = compiler.compile(contract, 1)

				const contractByteCode = '0x' + result.contracts[':HTLC'].bytecode
				const contractAbi = result.contracts[':HTLC'].interface

				const rawTransaction = ethers.Contract.getDeployTransaction(contractByteCode, contractAbi)

				const transaction = await wallet.sendTransaction({
					data: rawTransaction.data,
					value: ethers.utils.parseEther(_swap.amount2.toString())
				})
		
				let contractAddress
				while (contractAddress === undefined) {
					contractAddress = await getContractAddress(transaction.hash)
				}
				resolve(contractAddress)
			})
		})
	},

	spend: (_swap) => {
		return new Promise((resolve, reject) => {
			const privateKey = '0x505bdbc30b8f84d06dbfb4c780a5504c87a2a13731f11c41c0f9b4247b719985'
	  		const provider = ethers.providers.getDefaultProvider('rinkeby');
			const wallet = new ethers.Wallet(privateKey, provider)
			const timeLock = 60

			// solidity code
			const contract = `pragma solidity ^0.4.0; contract HTLC { uint public lockTime = ${timeLock} seconds; address public toAddress = ${_swap.sellerAddress1}; bytes32 public hash = 0x${_swap.hash}; uint public startTime = now; address public fromAddress; string public key; uint public fromValue; function HTLC() payable { fromAddress = msg.sender; fromValue = msg.value; } modifier condition(bool _condition) { require(_condition); _; } function checkKey(string _key) payable condition ( sha256(_key) == hash ) returns (string) { toAddress.transfer(fromValue); key = _key; return key; } function withdraw () payable condition ( startTime + lockTime < now ) returns (uint) { fromAddress.transfer(fromValue); return fromValue; } }`
			
			// load compiler
			BrowserSolc.loadVersion("soljson-v0.4.20+commit.3155dd80.js", async (compiler) => {
				const result = compiler.compile(contract, 1)

				const contractByteCode = '0x' + result.contracts[':HTLC'].bytecode
				const contractAbi = result.contracts[':HTLC'].interface

				// @TODO interact with contract
				const interface = new ethers.Interface(contractAbi)
				console.log('interface', interface)
				const rawTransaction = interface.functions.checkKey(_swap.key)
				console.log('rawTransaction', rawTransaction)

				const transaction = await wallet.sendTransaction({
					data: rawTransaction.data,
					to: _swap.transaction1
				})
		
				// get the contract address from transaction hash
				return transaction.hash
			})
		})
	},

	redeem: (_swap) => {
		return 'redeemScript992929'
	},
}

async function getContractAddress(addressHash) {
	try {
		const data = await $.get(`https://api-rinkeby.etherscan.io/api?module=proxy&action=eth_getTransactionReceipt&txhash=${addressHash}`)
		return data.result.contractAddress
	} catch (e) {
		return undefined
	}
}