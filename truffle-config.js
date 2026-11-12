

module.exports = {

  networks: {
    development: {
     host: "127.0.0.1",     // 本地地址
     port: 7545,            // Ganache 的端口（请检查Ganache界面是7545还是8545）
     network_id: "*",       // 匹配任何网络 id
    },
  },
  // 确保编译器版本正确
  compilers: {
    solc: {
      version: "0.8.19",    // 与合约 pragma 一致
    }
  },

  // Set default mocha options here, use special reporters, etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.19",    // 保持你当前的编译器版本
      settings: {          // 添加 settings 块
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "paris" // <--- 关键！强制使用 Paris 版本（不支持 PUSH0），Ganache 就能识别了
      }
    }
  },
};
