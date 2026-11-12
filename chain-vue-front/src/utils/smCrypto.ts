// src/utils/smCrypto.ts
import { sm2, sm3 } from 'sm-crypto';

// ⚠️ 替换为你刚才生成的公钥
const PUBLIC_KEY = '0465aeac38c288dc89eff140cc3b190d902dc678f08c3d12cd249382fcd88852823a39530140d743843d575e36c331e9910ac60983fe5e4844cbe72404c59e72a3'; 

// 1. SM2 加密 (传输敏感信息)
export const doSm2Encrypt = (text: string): string => {
  // 1 表示 C1C3C2 模式，这是国密标准推荐的模式
  return sm2.doEncrypt(text, PUBLIC_KEY, 1);
};

// 2. SM3 摘要/签名 (用于验证完整性)
export const doSm3Hash = (text: string): string => {
  return sm3(text);
};