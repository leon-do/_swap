const ethereum = {
	address: (_swap) => {
		return '0x' + privateToAddress(private_key.ethereum).toString('hex')
	},

	pay: (_swap) => {
		console.log('wallet/ethereum.js::pay()')

		return new Promise((resolve, reject) => {
	    	const provider = ethers.providers.getDefaultProvider('rinkeby');
			const wallet = new ethers.Wallet(private_key.ethereum, provider)
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
					value: ethers.utils.parseEther(_swap.amount1.toString())
				})
		
				let contractAddress
				while (contractAddress === undefined) {
					await pause(5000)
					console.log('waiting for contract address...')
					contractAddress = await getContractAddress(transaction.hash)
				}
				console.log('wallet/ethereum.js::pay()::contractAddress =', contractAddress)
				resolve(contractAddress)
			})
		})
	},

	spend: (_swap) => {
		console.log('wallet/ethereum.js::spend()')
		
		return new Promise((resolve, reject) => {
	  		const provider = ethers.providers.getDefaultProvider('rinkeby');
			const wallet = new ethers.Wallet(private_key.ethereum, provider)
			const timeLock = 60

			// solidity code
			const contract = `pragma solidity ^0.4.0; contract HTLC { uint public lockTime = ${timeLock} seconds; address public toAddress = ${_swap.sellerAddress2}; bytes32 public hash = 0x${_swap.hash}; uint public startTime = now; address public fromAddress; string public key; uint public fromValue; function HTLC() payable { fromAddress = msg.sender; fromValue = msg.value; } modifier condition(bool _condition) { require(_condition); _; } function checkKey(string _key) payable condition ( sha256(_key) == hash ) returns (string) { toAddress.transfer(fromValue); key = _key; return key; } function withdraw () payable condition ( startTime + lockTime < now ) returns (uint) { fromAddress.transfer(fromValue); return fromValue; } }`
			
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
					to: _swap.transaction2
				})
		
				// get the contract address from transaction hash
				console.log('wallet/ethereum.js::spend()::transaction.hash =', transaction.hash)
				resolve(transaction.hash)
			})
		})
	},

	redeem: (_swap) => {
		return 'redeemScript992929'
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

function pause(milliseconds){
    return new Promise(resolve => {
        setTimeout(function(){ 
            resolve(true)
        }, milliseconds)
    })
}