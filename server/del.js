const bitcore = require('bitcore-lib')
const privateKey = bitcore.PrivateKey.fromWIF('cN5R8xvMxB9QTGTVHh26BDZaBP1Zt1BsAmhY4CPo7yWZwSvyLuSN')
console.log(privateKey.toAddress().toString())