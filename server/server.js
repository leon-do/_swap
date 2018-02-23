// set up server
const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const bodyParser = require('body-parser')

// require lock to get hash and key
const lock = require('./database/lock.js')

// combine wallets
const wallet = {
	bitcoin: require('./wallet/bitcoin.js'),
	ethereum: require('./wallet/ethereum.js')
}

express()

.use(bodyParser.urlencoded({ extended: true }))

.post('/open', async (req, res) => {
	res.header('Access-Control-Allow-Origin', '*')

	const _swap = req.body
	_swap.hash = await lock.hash(_swap)
	_swap.sellerAddress1 = await wallet[_swap.coin1].address(_swap)
	_swap.sellerAddress2 = await wallet[_swap.coin2].address(_swap)
	_swap.transaction2 = await wallet[_swap.coin2].pay(_swap)
	res.send(_swap)

})

.post('/close', async (req, res) => {
	res.header('Access-Control-Allow-Origin', '*')
	
	const _swap = req.body
	_swap.key = await lock.key(_swap)
	await wallet[_swap.coin1].spend(_swap)

	console.log('\n\n\n swap before close', _swap)
	res.send(_swap)
})

.listen(PORT, () => {console.log(PORT)})







