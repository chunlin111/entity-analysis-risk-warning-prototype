// server/utils/smCrypto.js
const { sm2, sm3 } = require('sm-crypto');

// ⚠️ 替换为你刚才生成的私钥
const PRIVATE_KEY = '********'; 
// 固定盐值（Salt），防止彩虹表攻击，随便写一串复杂的
const DB_SALT = 'My_Super_Secret_Salt_2026!'; 

/**
 * SM2 解密
 */
const decrypt = (ciphertext) => {
    try {
        const result = sm2.doDecrypt(ciphertext, PRIVATE_KEY, 1);
        
        return result;
    } catch (e) {
        console.error("❌ 解密报错:", e.message); // 这里会告诉你具体哪里错了
        return null; 
    }
};

/**
 * SM3 哈希 (用于比对签名)
 */
const sm3Hash = (text) => {
    return sm3(text);
};

/**
 * SM3 存储哈希 (加盐，存数据库用)
 */
const dbHash = (password) => {
    return sm3(password + DB_SALT);
};

module.exports = { decrypt, sm3Hash, dbHash };
