const bitcore = require('bitcore-lib')
const request = require('request')
const Insight = require("bitcore-explorers").Insight
const insight = new Insight("testnet")
const private_key = require('../database/private_key.js')

module.exports = {
    address: (_swap) => {
        return bitcore.PrivateKey.fromWIF(private_key.bitcoin).toAddress().toString()
    },

    pay: (_swap) => {
        return new Promise(async (resolve, reject) => {
            // convert wif to a private key
            const privateKey = bitcore.PrivateKey.fromWIF(private_key.bitcoin)
            console.log('privateKey', privateKey)

            // get public key
            var publicKey = new bitcore.PublicKey(privateKey)
            console.log('\n\npublicKey =', publicKey)

            // convert priv key to address
            const fromAddress = privateKey.toAddress().toString()
            console.log('\n\nfromAddress =', privateKey.toAddress().toString())

            // get utxo data to add to new transaction
            const utxoData = await payUtxoData(fromAddress)
            console.log('\n\nutxoData =', utxoData)

            // get transaction id 9ce9ceb57475b631a64e162b539a915122bda10510315ec6189316d502424fa8
            const oldTransaction = utxoData.txid
            console.log('\n\noldTransaction =', oldTransaction)

            // get value 1921977
            const inputAmount = utxoData.value_int
            console.log('\n\ninputAmount =', inputAmount)

            // https://www.youtube.com/watch?v=YoPV9hfm6yk&t=9m57s
            // 76a9146450e6ad3689b8fcf4e43680c0ea6e56e17c0a3888ac
            // https://chainquery.com/bitcoin-api/decodescript
            const scriptPubKey = utxoData.script_pub_key
            console.log('\n\nscriptPubKey =', scriptPubKey)

            // 1
            const vout = utxoData.vout
            console.log('\n\nvout =', vout)

            // create unsigned transaction out
            const utxo = new bitcore.Transaction.UnspentOutput({
                "txid" : oldTransaction,
                "vout" : vout,
                "address" : fromAddress,
                "scriptPubKey" : scriptPubKey,
                "satoshis" : inputAmount
            });
            console.log('\n\nutxo =', utxo)

            // build the script
            var script = bitcore
                .Script()
                .add('OP_IF')
                .add('OP_SHA256')
                .add(new Buffer(_swap.hash, 'hex'))
                .add('OP_EQUALVERIFY')
                .add(bitcore.Script.buildPublicKeyHashOut(bitcore.Address.fromString(_swap.buyerAddress2)))
                .add('OP_ELSE')
                .add(bitcore.crypto.BN.fromNumber(1513412288).toScriptNumBuffer())
                .add('OP_CHECKLOCKTIMEVERIFY')
                .add('OP_DROP')
                .add(bitcore.Script.buildPublicKeyHashOut(bitcore.Address.fromString(fromAddress)))
                .add('OP_ENDIF')

            const scriptAddress = bitcore.Address.payingTo(script).toString()
            console.log('\n\nscriptAddress =', scriptAddress)

            const newTransaction = bitcore
                .Transaction() // create new tx
                .from(utxo) // from oldTransaction
                .to(scriptAddress, _swap.amount2 * 100000000)
                .change(fromAddress)
                .sign(privateKey)

            console.log( '\n\nnewTransaction =', require('util').inspect(newTransaction.toObject(), false, null) )

            // https://live.blockcypher.com/btc-testnet/decodetx/
            console.log('\n\nSerialized Transaction =\n', newTransaction.toString())

            // broadcast transaction
            insight.broadcast(newTransaction.toString(), function(error, transactionId) {
                console.log('transactionId', transactionId)
                resolve(transactionId)
            });
        })
    },

    spend:  (_swap) => {
        return new Promise (async (resolve, reject) => {
            // convert wif to a private key
            const privateKey = bitcore.PrivateKey.fromWIF(private_key.bitcoin)
            console.log('privateKey', privateKey)

            // get public key
            var myPublicKey = new bitcore.PublicKey(privateKey)
            console.log('myPublicKey', myPublicKey)

            // convert priv key to address
            const fromAddress = privateKey.toAddress().toString()
            console.log(fromAddress)

            // get utxo data to add to new transaction
            const utxoData = await spendUtxoData(_swap.transaction2)
            console.log('utxoData =', utxoData)

            // get value 1921977
            const inputAmount = utxoData.value_int
            console.log('inputAmount', inputAmount)

            const scriptPubKey = utxoData.script_pub_key
            console.log('scriptPubKey', scriptPubKey)

            const sequenceNumber = utxoData.sequence
            console.log('sequenceNumber', sequenceNumber)

            const vout = utxoData.vout
            console.log('vout', vout)

            // https://bitcore.io/api/lib/unspent-output
            const refundTransaction = new bitcore.Transaction().from({
                txid: _swap.transaction2,
                vout: vout,
                scriptPubKey: new bitcore.Script(scriptPubKey).toHex(), //  https://github.com/bitpay/bitcore-lib/blob/master/docs/examples.md
                satoshis: inputAmount,
            })
                .to(fromAddress, inputAmount - 1000) // or Copay: mqsscUaTAy3pjwgg7LVnQWr2dFCKphctM2
                .lockUntilDate(Math.floor(Date.now() / 1001)); // CLTV requires the transaction nLockTime to be >= the stack argument in the redeem script
            console.log('refundTransaction', refundTransaction)

            refundTransaction.inputs[0].sequenceNumber = 0; // the CLTV opcode requires that the input's sequence number not be finalized

            const signature = bitcore.Transaction.sighash.sign(refundTransaction, privateKey, bitcore.crypto.Signature.SIGHASH_ALL, 0, scriptPubKey);
            console.log('signature', signature)

            // setup the scriptSig of the spending transaction to spend the p2sh-cltv-p2pkh redeem script
            refundTransaction.inputs[0].setScript(
                bitcore.Script.empty()
                    .add(signature.toTxFormat())
                    .add(new Buffer(myPublicKey.toString(), 'hex'))
                    .add(new Buffer(toHex(_swap.key).toString(), 'hex'))
                    .add('OP_TRUE') // choose the time-delayed refund code path
            )
            console.log('refundTransaction', refundTransaction.toString())

            // broadcast transaction
            insight.broadcast(refundTransaction.toString(), function(error, transactionId) {
                console.log('transactionId', transactionId)
                resolve(transactionId)
            });
        })
    },

    redeem: async (_swap) => {
        return 'bitcoinRedeemScript'
    }
}


//  https://testnet-api.smartbit.com.au/v1/blockchain/address/mpfNnLq357BjK5btmefSGT38PsQQgMkZXB
function payUtxoData (_address) {

    // // @TODO remove when you have internet
    // return {
    //     value_int: 20222,
    //     txid: '9718c4b4edcfdd307ca7f663d7d39fe4f46cbd1b1896e3a334bd2563c5cc5bb2',
    //     script_pub_key: '76a91438391dfb844190c70ecea35731a50eeb6ab8637388ac',
    //     vout: 0
    // }


    return new Promise(resolve => {
        request(`https://testnet-api.smartbit.com.au/v1/blockchain/address/${_address}`, (err, res, body) => {
            const data = JSON.parse(body)
            const transactions = data.address.transactions
            // loop through transactions
            for (let i in transactions){
                // loop through the output of each transaction
                for (let j in transactions[i].outputs){
                    // if output has BTC and it belongs to me
                    if (transactions[i].outputs[j].spend_txid !== 'null' && transactions[i].outputs[j].value_int > 0 && transactions[i].outputs[j].addresses[0] === _address) {
                        return resolve({
                            value_int: transactions[i].outputs[j].value_int,
                            txid: transactions[i].txid,
                            script_pub_key: transactions[i].outputs[j].script_pub_key.hex,
                            vout: transactions[i].outputs[j].n
                        })
                    }
                }
            }
        })
    })
}


function spendUtxoData (_transactionId) {
    return new Promise(resolve => {
        request(`https://testnet-api.smartbit.com.au/v1/blockchain/tx/${_transactionId}`, (err, res, body) => {
            const data = JSON.parse(body)
            return resolve({
                value_int: data.transaction.outputs[0].value_int,
                txid: _transactionId,
                script_pub_key: data.transaction.outputs[0].script_pub_key.hex,
                vout: data.transaction.outputs[0].n,
                sequence: data.transaction.inputs[0].sequence
            })
        })
    })
}

function toHex(str) {
    var hex = '';
    for(var i=0;i<str.length;i++) {
        hex += ''+str.charCodeAt(i).toString(16);
    }
    return hex;
}