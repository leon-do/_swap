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
    .use(bodyParser.json())

    .post('/open', async (req, res) => {
        res.header('Access-Control-Allow-Origin', '*')
        try {
            const _swap = req.body
            console.log('step 2', _swap)
            _swap.hash = await lock.hash(_swap)
            _swap.timeLock2 = await wallet[_swap.coin2].timeLock(_swap)
            _swap.sellerAddress1 = await wallet[_swap.coin1].address(_swap)
            _swap.sellerAddress2 = await wallet[_swap.coin2].address(_swap)
            _swap.sellerTransaction2 = await wallet[_swap.coin2].pay(_swap)
            console.log('step 3', _swap)
            res.send(_swap)
        } catch (e) {
            console.log('/open error', e)
            res.status(500)
        }
    })

    .post('/close', async (req, res) => {
        res.header('Access-Control-Allow-Origin', '*')
        try {
            const _swap = req.body
            console.log('step 6 =', _swap)
            _swap.key = await lock.key(_swap)
            _swap.sellerTransaction1 = await wallet[_swap.coin1].spend(_swap)
            console.log('step 7', _swap)
            res.send(_swap)
        } catch (e) {
            console.log('/close error', e)
            res.status(500)
        }
    })

    .listen(PORT)
