const bitcoin = {
    address: _swap => {
        console.log('bitcoin.js:address()')
        const privateKey = bitcore.PrivateKey.fromWIF(private_key.bitcoin)
        return privateKey.toAddress().toString()
    },

    pay: async _swap => {},

    spend: async _swap => {
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
            await pause(5000)
            console.log('fetching bitcoin transaction...')
            utxoData = await spendUtxoData(_swap.transaction2)
        }

        // get value 1921977
        const inputAmount = utxoData.value_int

        const scriptPubKey = utxoData.script_pub_key

        const sequenceNumber = utxoData.sequence

        // 1
        const vout = utxoData.vout

        // build the script
        const redeemScript = bitcore
            .Script()
            .add('OP_IF')
            .add('OP_SHA256')
            .add(new Buffer(_swap.hash, 'hex'))
            .add('OP_EQUALVERIFY')
            .add(bitcore.Script.buildPublicKeyHashOut(bitcore.Address.fromString(_swap.buyerAddress2)))
            .add('OP_ELSE')
            .add(bitcore.crypto.BN.fromNumber(Number(_swap.timeLock2)).toScriptNumBuffer())
            .add('OP_CHECKLOCKTIMEVERIFY')
            .add('OP_DROP')
            .add(bitcore.Script.buildPublicKeyHashOut(bitcore.Address.fromString(_swap.sellerAddress2)))
            .add('OP_ENDIF')

        const refundTransaction = new bitcore.Transaction()
            .from({
                txid: _swap.transaction2,
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

        console.log('refundTransaction', refundTransaction)

        const data = await $.post('https://test-insight.bitpay.com/api/tx/send', {
            rawtx: refundTransaction.toString()
        })
        console.log('wallet/bitcoin.js::spend()::data.txid =', data.txid)
        return data.txid
    },

    redeem: async _swap => {
        return 'bitcoinredeemScript'
    }
}

//  https://testnet-api.smartbit.com.au/v1/blockchain/address/mpfNnLq357BjK5btmefSGT38PsQQgMkZXB
function payUtxoData(_address, _amount) {
    return new Promise(resolve => {
        fetch(`https://testnet-api.smartbit.com.au/v1/blockchain/address/${_address}`)
            .then(response => {
                return response.json()
            })
            .then(data => {
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
                            resolve({
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

//  https://testnet-api.smartbit.com.au/v1/blockchain/address/mpfNnLq357BjK5btmefSGT38PsQQgMkZXB
function spendUtxoData(_transactionId) {
    return new Promise(resolve => {
        fetch(`https://testnet-api.smartbit.com.au/v1/blockchain/tx/${_transactionId}`)
            .then(response => {
                return response.json()
            })
            .then(data => {
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
    let hex = ''
    for (let i = 0; i < str.length; i++) {
        hex += '' + str.charCodeAt(i).toString(16)
    }
    return hex
}

function pause(milliseconds) {
    return new Promise(resolve => {
        setTimeout(function() {
            resolve(true)
        }, milliseconds)
    })
}
