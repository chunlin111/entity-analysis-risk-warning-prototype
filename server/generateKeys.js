const sm2 = require('sm-crypto').sm2;

const keypair = sm2.generateKeyPairHex();

console.log("公钥 (给前端):", keypair.publicKey); 
console.log("私钥 (后端保留):", keypair.privateKey);