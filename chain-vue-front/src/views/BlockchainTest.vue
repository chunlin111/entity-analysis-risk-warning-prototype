<template>
    <div class="test-container">
      <el-card class="box-card">
        <template #header>
          <div class="card-header">
            <span>🔬 区块链功能实验室 (Ganache 直连)</span>
            <el-tag type="warning">公开测试环境</el-tag>
          </div>
        </template>
  
        <div class="section">
          <h3>1. 模拟钱包连接</h3>
          <div v-if="!account">
            <el-alert title="仅用于本地测试，请使用 Ganache 私钥" type="info" show-icon :closable="false" style="margin-bottom: 15px" />
            <el-input v-model="privateKeyInput" placeholder="请输入 Ganache 私钥 (0x开头...)" show-password>
              <template #append>
                <el-button @click="loginWithKey" type="primary">连接钱包</el-button>
              </template>
            </el-input>
          </div>
          <div v-else class="account-info">
            <el-descriptions border :column="1">
              <el-descriptions-item label="当前账户">
                <el-tag>{{ account }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="操作">
                <el-button size="small" type="danger" @click="logout">断开连接</el-button>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
  
        <el-divider />
  
        <div class="section">
          <h3>2. 数据存证上链 (Write)</h3>
          <div class="input-area">
            <el-input v-model="inputData" placeholder="输入要上链的文本信息..." :disabled="!account">
              <template #append>
                <el-button @click="uploadData" :loading="loading" :disabled="!account" type="success">提交上链</el-button>
              </template>
            </el-input>
          </div>
        </div>
  
        <el-divider />
  
        <div class="section">
          <h3>3. 链上数据查验 (Verify)</h3>
          <el-input v-model="verifyInput" placeholder="输入内容比对链上指纹..." :disabled="!contract">
            <template #append>
              <el-button @click="verifyData" icon="Search">查验</el-button>
            </template>
          </el-input>
          
          <div v-if="verifyResult" :class="['verify-result', verifyResult.status]">
            <el-icon v-if="verifyResult.status === 'success'"><CircleCheckFilled /></el-icon>
            <el-icon v-else><CircleCloseFilled /></el-icon>
            <span>{{ verifyResult.message }}</span>
          </div>
        </div>
  
        <el-divider />
  
        <div class="section">
          <div class="list-header">
            <h3>4. 链上全量记录 (Read)</h3>
            <el-button size="small" @click="getRecords" :disabled="!contract" icon="Refresh">刷新列表</el-button>
          </div>
          
          <el-table :data="records" stripe style="width: 100%; margin-top: 10px" border height="250">
            <el-table-column prop="index" label="ID" width="60" />
            <el-table-column prop="content" label="存证内容" />
            <el-table-column prop="time" label="上链时间" width="180" />
            <el-table-column prop="uploader" label="上传者" width="180" show-overflow-tooltip />
          </el-table>
        </div>
  
        <div class="footer-link">
          <router-link to="/login">返回登录页</router-link>
        </div>
      </el-card>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import Web3 from 'web3';
  import { ElMessage } from 'element-plus';
  import { CircleCheckFilled, CircleCloseFilled, Search, Refresh } from '@element-plus/icons-vue';
  import SimpleStorageJSON from '../../../build/contracts/SimpleStorage.json'; // 确保路径对！如果报错请调整 ../ 的数量
  
  // === 配置 ===
  const CONTRACT_ADDRESS = "0x0bb0c1644e02e630DDCdfC12fD5eb5B3C8C0A7C4"; // 你的合约地址
  const RPC_URL = "http://127.0.0.1:7545";
  // ===========
  
  const privateKeyInput = ref('');
  const account = ref('');
  const inputData = ref('');
  const verifyInput = ref('');
  const verifyResult = ref<any>(null);
  const records = ref<any[]>([]);
  const loading = ref(false);
  
  let web3: Web3 | null = null;
  let contract: any = null;
  
  onMounted(() => {
    try {
      web3 = new Web3(RPC_URL);
      // 尝试加载合约（如果文件路径不对这里会报错，请检查 import）
      if ((SimpleStorageJSON as any).abi) {
        contract = new web3.eth.Contract((SimpleStorageJSON as any).abi, CONTRACT_ADDRESS);
        getRecords(); // 页面加载就读一次数据
      }
    } catch (error) {
      console.error("Web3 Init Error:", error);
      ElMessage.error("无法连接到 Ganache，请检查 RPC 地址");
    }
  });
  
  const loginWithKey = () => {
    if (!privateKeyInput.value) return ElMessage.warning("请输入私钥");
    try {
      let key = privateKeyInput.value.trim();
      if (!key.startsWith('0x')) key = '0x' + key;
      if (!web3) return;
  
      const accountObj = web3.eth.accounts.privateKeyToAccount(key);
      web3.eth.accounts.wallet.add(accountObj);
      account.value = accountObj.address;
      
      privateKeyInput.value = '';
      ElMessage.success("钱包连接成功");
    } catch (error: any) {
      ElMessage.error("私钥错误: " + error.message);
    }
  };
  
  const logout = () => {
    if (web3) web3.eth.accounts.wallet.clear();
    account.value = '';
  };
  
  const uploadData = async () => {
    if (!inputData.value) return ElMessage.warning("内容不能为空");
    try {
      loading.value = true;
      await contract.methods.storeData(inputData.value).send({
        from: account.value,
        gas: 3000000
      });
      ElMessage.success("上链成功！");
      inputData.value = '';
      getRecords();
    } catch (error: any) {
      ElMessage.error("上链失败: " + error.message);
    } finally {
      loading.value = false;
    }
  };
  
  const getRecords = async () => {
    if (!contract) return;
    try {
      const count = await contract.methods.getRecordCount().call();
      const tempRecords = [];
      for (let i = 0; i < Number(count); i++) {
        const record: any = await contract.methods.getRecord(i).call();
        tempRecords.push({
          index: i,
          content: record[0],
          time: new Date(Number(record[1]) * 1000).toLocaleString(),
          uploader: record[2]
        });
      }
      // 倒序排列，最新的在上面
      records.value = tempRecords.reverse();
    } catch (error) {
      console.error(error);
    }
  };
  
  const verifyData = async () => {
    if (!verifyInput.value || !contract) return;
    verifyResult.value = null;
    
    try {
      const count = await contract.methods.getRecordCount().call();
      let found = false;
      for (let i = 0; i < Number(count); i++) {
        const record: any = await contract.methods.getRecord(i).call();
        if (record[0] === verifyInput.value.trim()) {
          found = true;
          break;
        }
      }
      
      if (found) {
        verifyResult.value = { status: 'success', message: '✅ 查验成功：数据真实存在于链上' };
      } else {
        verifyResult.value = { status: 'error', message: '❌ 查验失败：链上未找到该数据' };
      }
    } catch (error) {
      ElMessage.error("查验出错");
    }
  };
  </script>
  
  <style scoped>
  .test-container { display: flex; justify-content: center; padding: 40px 0; min-height: 100vh; background: #f0f2f5; }
  .box-card { width: 800px; }
  .card-header { display: flex; justify-content: space-between; align-items: center; font-size: 18px; font-weight: bold; }
  .section h3 { margin-top: 0; color: #303133; }
  .input-area { display: flex; gap: 10px; }
  .list-header { display: flex; justify-content: space-between; align-items: center; }
  .verify-result { margin-top: 15px; padding: 10px; border-radius: 4px; display: flex; align-items: center; gap: 8px; }
  .verify-result.success { background: #f0f9eb; color: #67c23a; }
  .verify-result.error { background: #fef0f0; color: #f56c6c; }
  .footer-link { margin-top: 20px; text-align: center; }
  </style>