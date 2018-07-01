const bitcore = require('bitcore-lib')
const request = require('request')
const Insight = require('bitcore-explorers').Insight
const insight = new Insight('testnet')
const private_key = require('../database/private_key.js')

function address(_swap) {
    return bitcore.PrivateKey.fromWIF(private_key.bitcoin)
        .toAddress()
        .toString()
}

function timeLock(_swap) {
    return Math.floor(Date.now() / 1000)
}

function pay(_swap) {
    console.log('wallet/bitcoin.js::pay()')

    return new Promise(async (resolve, reject) => {
        // convert wif to a private key
        const privateKey = bitcore.PrivateKey.fromWIF(private_key.bitcoin)

        // convert priv key to address
        const fromAddress = privateKey.toAddress().toString()

        // get utxo data to add to new transaction
        const utxoData = await payUtxoData(fromAddress, _swap.amount2 * 100000000)
        //console.log('\n\noutput =', output)

        // get transaction id 9ce9ceb57475b631a64e162b539a915122bda10510315ec6189316d502424fa8
        const oldTransaction = utxoData.txid

        // get value 1921977
        const inputAmount = utxoData.value_int

        // https://chainquery.com/bitcoin-api/decodescript
        const scriptPubKey = utxoData.script_pub_key

        // 1
        const vout = utxoData.vout

        // create unsigned transaction out
        const utxo = new bitcore.Transaction.UnspentOutput({
            txid: oldTransaction,
            vout: vout,
            address: fromAddress,
            scriptPubKey: scriptPubKey,
            satoshis: inputAmount
        })

        // build the script
        const script = bitcore
            .Script()
            .add('OP_IF')
            .add('OP_SHA256')
            .add(new Buffer(_swap.hash, 'hex'))
            .add('OP_EQUALVERIFY')
            .add(bitcore.Script.buildPublicKeyHashOut(bitcore.Address.fromString(_swap.buyerAddress2)))
            .add('OP_ELSE')
            .add(bitcore.crypto.BN.fromNumber(_swap.timeLock2).toScriptNumBuffer())
            .add('OP_CHECKLOCKTIMEVERIFY')
            .add('OP_DROP')
            .add(bitcore.Script.buildPublicKeyHashOut(bitcore.Address.fromString(fromAddress)))
            .add('OP_ENDIF')

        const scriptAddress = bitcore.Address.payingTo(script)

        const newTransaction = bitcore
            .Transaction() // create new tx
            .from(utxo) // from oldTransaction
            .to(scriptAddress, _swap.amount2 * 100000000)
            .change(fromAddress)
            .sign(privateKey)

        insight.broadcast(newTransaction.toString(), function(error, transactionId) {
            if (error) {
                reject(error)
            }
            console.log('wallet/bitcoin.js::pay() transactionId =', transactionId)
            resolve(transactionId)
        })
    })
}

async function spend(_swap) {
    console.log('wallet/bitcoin.js::spend()')

    // convert wif to a private key
    const privateKey = bitcore.PrivateKey.fromWIF(private_key.bitcoin)

    // get public key
    const myPublicKey = new bitcore.PublicKey(privateKey)

    // convert priv key to address
    const fromAddress = privateKey.toAddress().toString()

    // get utxo data to add to new transaction
    let utxoData = undefined
    while (utxoData === undefined) {
        console.log('fetching bitcoin transaction...')
        utxoData = await spendUtxoData(_swap.buyerTransaction1)
        await pause(500)
    }

    // get value 1921977
    const inputAmount = utxoData.value_int

    // 1
    const vout = utxoData.vout

    // build the script
    const redeemScript = bitcore
        .Script()
        .add('OP_IF')
        .add('OP_SHA256')
        .add(new Buffer(_swap.hash, 'hex'))
        .add('OP_EQUALVERIFY')
        .add(bitcore.Script.buildPublicKeyHashOut(bitcore.Address.fromString(_swap.buyerAddress1)))
        .add('OP_ELSE')
        .add(bitcore.crypto.BN.fromNumber(Number(_swap.timeLock1)).toScriptNumBuffer())
        .add('OP_CHECKLOCKTIMEVERIFY')
        .add('OP_DROP')
        .add(bitcore.Script.buildPublicKeyHashOut(bitcore.Address.fromString(_swap.sellerAddress1)))
        .add('OP_ENDIF')

    const refundTransaction = new bitcore.Transaction()
        .from({
            txid: _swap.buyerTransaction1,
            vout: vout,
            scriptPubKey: redeemScript.toScriptHashOut(),
            satoshis: inputAmount
        })
        .to(fromAddress, inputAmount - 1000) // or Copay: mqsscUaTAy3pjwgg7LVnQWr2dFCKphctM2
        .lockUntilDate(1513412288) // CLTV requires the transaction nLockTime to be >= the stack argument in the redeem script

    refundTransaction.inputs[0].sequenceNumber = 0 // the CLTV opcode requires that the input's sequence number not be finalized

    const signature = bitcore.Transaction.sighash.sign(
        refundTransaction,
        privateKey,
        bitcore.crypto.Signature.SIGHASH_ALL,
        0,
        redeemScript
    )

    // setup the scriptSig of the spending transaction to spend the p2sh-cltv-p2pkh redeem script
    refundTransaction.inputs[0].setScript(
        bitcore.Script.empty()
            .add(signature.toTxFormat())
            .add(new Buffer(myPublicKey.toString(), 'hex'))
            .add(new Buffer(toHex(_swap.key).toString(), 'hex'))
            .add('OP_TRUE') // choose the time-delayed refund code path
            .add(redeemScript.toBuffer())
    )

    // broadcast
    const transactionId = await broadcast(refundTransaction)
    console.log('transactionId:', transactionId)
    return transactionId
}

async function redeem(_swap) {
    return 'bitcoinRedeemTransaction'
}

//  https://testnet-api.smartbit.com.au/v1/blockchain/address/mpfNnLq357BjK5btmefSGT38PsQQgMkZXB
function payUtxoData(_address, _amount) {
    return new Promise(resolve => {
        request(`https://testnet-api.smartbit.com.au/v1/blockchain/address/${_address}`, (err, res, body) => {
            const data = JSON.parse(body)
            const transactions = data.address.transactions
            // loop through transactions
            for (let i in transactions) {
                // loop through the output of each transaction
                for (let j in transactions[i].outputs) {
                    // if output has BTC and it belongs to me
                    if (
                        transactions[i].outputs[j].spend_txid !== 'null' &&
                        transactions[i].outputs[j].value_int > _amount &&
                        transactions[i].outputs[j].addresses[0] === _address
                    ) {
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

function spendUtxoData(_transactionId) {
    return new Promise(resolve => {
        request(`https://testnet-api.smartbit.com.au/v1/blockchain/tx/${_transactionId}`, (err, res, body) => {
            try {
                const data = JSON.parse(body)
                resolve({
                    value_int: data.transaction.outputs[0].value_int,
                    txid: _transactionId,
                    script_pub_key: data.transaction.outputs[0].script_pub_key.hex,
                    vout: data.transaction.outputs[0].n,
                    sequence: data.transaction.inputs[0].sequence
                })
            } catch (e) {
                resolve(undefined)
            }
        })
    })
}

function toHex(str) {
    let hex = ''
    for (let i = 0; i < str.length; i++) {
        hex += '' + str.charCodeAt(i).toString(16)
    }
    return hex
}

function broadcast(_transaction) {
    return new Promise((resolve, reject) => {
        insight.broadcast(_transaction.toString(), (error, transactionId) => {
            if (error) {
                reject(error)
            }
            resolve(transactionId)
        })
    })
}

function pause(milliseconds) {
    return new Promise(resolve => {
        setTimeout(function() {
            resolve(true)
        }, milliseconds)
    })
}

module.exports = { address, timeLock, pay, spend, redeem }
