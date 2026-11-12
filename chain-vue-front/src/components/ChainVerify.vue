<template>
  <div class="verify-component">
    <el-card shadow="never" class="input-card">
      <div class="verify-header">
        <h3>🔍 区块链存证查验</h3>
        <p class="subtitle">输入交易哈希 (Tx Hash)，由系统后端节点从区块链网络验证数据的真实性与完整性。</p>
      </div>
      
      <div class="input-area">
        <el-input 
          v-model="txHash" 
          placeholder="请输入 0x 开头的交易哈希..." 
          clearable 
          size="large"
          @keyup.enter="handleVerify"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
          <template #append>
            <el-button type="primary" @click="handleVerify" :loading="loading">开始查验</el-button>
          </template>
        </el-input>
      </div>
    </el-card>

    <transition name="el-fade-in">
      <div v-if="result" class="result-area">
        <el-alert
          :title="result.status ? '✅ 查验成功：交易已上链确认' : '❌ 查验失败：交易未找到或失败'"
          :type="result.status ? 'success' : 'error'"
          show-icon
          :closable="false"
          class="status-alert"
        />

        <el-card class="detail-card">
          <template #header>
            <div class="detail-header">
              <span>📦 存证内容解码</span>
              <el-tag size="small">Input Data</el-tag>
            </div>
          </template>
          
          <div v-if="result.decodedData" class="json-box">
            <pre>{{ JSON.stringify(result.decodedData, null, 2) }}</pre>
          </div>
          <div v-else class="raw-box">
            <p>原始 Hex 数据：</p>
            <div class="hex-text">{{ result.input }}</div>
            <p style="margin-top:10px; color:#999">⚠️ 该数据无法解析为 JSON，可能是加密数据或非标准存证。</p>
          </div>
        </el-card>

        <el-descriptions border :column="2" class="meta-info">
          <el-descriptions-item label="区块高度">{{ result.blockNumber }}</el-descriptions-item>
          <el-descriptions-item label="Gas 消耗">{{ result.gasUsed }}</el-descriptions-item>
          <el-descriptions-item label="发起方 (From)">
            <span class="mono">{{ result.from }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="接收方/合约 (To)">
            <span class="mono">{{ result.to }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="交易哈希" :span="2">
            <span class="mono">{{ result.hash }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios'; // 使用 axios
import { ElMessage } from 'element-plus';
import { Search } from '@element-plus/icons-vue'; 

const txHash = ref('');
const loading = ref(false);
const result = ref<any>(null);

const handleVerify = async () => {
  if (!txHash.value) return ElMessage.warning("请输入交易哈希");
  if (!txHash.value.startsWith('0x') || txHash.value.length !== 66) {
    return ElMessage.warning("哈希格式不正确 (0x开头，66位字符)");
  }

  loading.value = true;
  result.value = null;

  try {
    const token = localStorage.getItem('token');
    // === 核心修改：调用后端接口 ===
    const res = await axios.get(`/api/products/verify-transaction/${txHash.value}`, {
      headers: { 'x-auth-token': token }
    });

    result.value = res.data;
    ElMessage.success("查验完成");

  } catch (error: any) {
    console.error(error);
    ElMessage.error(error.response?.data?.msg || "查验失败，请检查哈希是否正确");
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.verify-component { max-width: 800px; margin: 0 auto; }
.verify-header { text-align: center; margin-bottom: 20px; }
.subtitle { color: #909399; font-size: 14px; margin-top: 5px; }
.input-area { margin-top: 20px; }
.result-area { margin-top: 30px; }
.status-alert { margin-bottom: 20px; }
.detail-card { margin-bottom: 20px; }
.detail-header { display: flex; justify-content: space-between; align-items: center; }
.json-box { background: #f8f8f8; padding: 15px; border-radius: 4px; font-family: monospace; overflow-x: auto; }
.hex-text { word-break: break-all; color: #909399; font-size: 12px; font-family: monospace; margin: 5px 0; }
.mono { font-family: monospace; color: #606266; word-break: break-all; }
.meta-info { background: #fff; }
</style>