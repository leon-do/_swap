const ethereum = {
	address: (_swap) => {
		return '0x5873E7b7F909B4F76ce4B7B3338DB674F1aC3a02'
	},

	pay: (_swap) => {

		const privateKey = '0x90ce4c3b2cbe150f941a07e50ea81426c71162f083651db362878d04b348ee06'
    	const provider = ethers.providers.getDefaultProvider('rinkeby');
		const wallet = new ethers.Wallet(privateKey, provider)

		return new Promise((resolve, reject) => {
			const timeLock = 60

			// solidity code
			const contract = `pragma solidity ^0.4.0; contract HTLC { uint public lockTime = ${timeLock} seconds; address public toAddress = ${_swap.sellerAddress1}; bytes32 public hash = 0x${_swap.hash}; uint public startTime = now; address public fromAddress; string public key; uint public fromValue; function HTLC() payable { fromAddress = msg.sender; fromValue = msg.value; } modifier condition(bool _condition) { require(_condition); _; } function checkKey(string _key) payable condition ( sha256(_key) == hash ) returns (string) { toAddress.transfer(fromValue); key = _key; return key; } function withdraw () payable condition ( startTime + lockTime < now ) returns (uint) { fromAddress.transfer(fromValue); return fromValue; } }`

			BrowserSolc.loadVersion("soljson-v0.4.20+commit.3155dd80.js", async (compiler) => {
				const result = compiler.compile(contract, 1)

				const contractByteCode = '0x' + result.contracts[':HTLC'].bytecode
				const contractAbi = result.contracts[':HTLC'].interface

				const rawTransaction = ethers.Contract.getDeployTransaction(contractByteCode, contractAbi)

				const transaction = await wallet.sendTransaction({
					data: rawTransaction.data,
					value: ethers.utils.parseEther(_swap.amount2.toString())
				})
		
				console.log('transaction', transaction.hash)
				resolve(transaction.hash)
			})
		})
	},

	spend: (_swap) => {
		return 'spendScript1220020'
	},

	redeem: (_swap) => {
		return 'redeemScript992929'
	},
}