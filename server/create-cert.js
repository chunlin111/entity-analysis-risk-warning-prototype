const forge = require('node-forge');
const fs = require('fs');

console.log('正在使用 node-forge 生成自签名证书...');

try {
    // 1. 生成 RSA 密钥对 (2048位)
    const keys = forge.pki.rsa.generateKeyPair(2048);
    
    // 2. 创建证书对象
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    
    // 设置有效期 (1年)
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    
    // 设置证书属性 (Common Name = localhost)
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    
    // 3. 使用私钥签名证书
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // 4. 转换为 PEM 格式字符串
    const pemKey = forge.pki.privateKeyToPem(keys.privateKey);
    const pemCert = forge.pki.certificateToPem(cert);

    // 5. 写入文件
    fs.writeFileSync('server.key', pemKey);
    fs.writeFileSync('server.cert', pemCert);

    console.log('✅ 证书生成成功！');
    console.log(' - 私钥已保存: server.key');
    console.log(' - 证书已保存: server.cert');

} catch (err) {
    console.error('❌ 生成失败:', err);
}