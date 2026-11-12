module.exports = {
    apps : [
        {
          name: "Business-Server",
          // 修改 1: script 改为相对于 cwd 的路径
          script: "./app.js",
          // 修改 2: 指定工作目录为 server 文件夹
          cwd: "./server",
          env: {
            NODE_ENV: "production",
            PORT: 3000
          }
        },
        {
          name: "AI-Service",
          // 修改 3: script 改为相对于 cwd 的路径
          script: "./Interface.py", 
          // 修改 4: 指定工作目录为 algorithm 文件夹 (关键修复!)
          cwd: "./algorithm",
        interpreter: "C:/ProgramData/anaconda3/envs/block-chain/pythonw.exe"    // 指定解释器，如果是虚拟环境请填具体路径
      }
    ]
  };