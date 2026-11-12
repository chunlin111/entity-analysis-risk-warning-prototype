<template>
  <div class="monitor-container">
    <el-row :gutter="20" class="dashboard-cards">
      <el-col :span="6">
        <el-card shadow="hover" class="data-card">
          <div class="card-icon blue"><el-icon><Odometer /></el-icon></div>
          <div class="card-info">
            <div class="label">当前区块高度</div>
            <div class="value">{{ blockNumber }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="data-card">
          <div class="card-icon orange"><el-icon><Money /></el-icon></div>
          <div class="card-info">
            <div class="label">实时 Gas 价格</div>
            <div class="value">{{ gasPrice }} <small>Gwei</small></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="data-card">
          <div class="card-icon purple"><el-icon><UserFilled /></el-icon></div>
          <div class="card-info">
            <div class="label">当前出块节点</div>
            <el-tooltip :content="miner" placement="top">
              <div class="value address-font">{{ formatAddress(miner) }}</div>
            </el-tooltip>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="data-card">
          <div class="card-icon green"><el-icon><ScaleToOriginal /></el-icon></div>
          <div class="card-info">
            <div class="label">区块 Gas 上限</div>
            <div class="value">{{ Number(gasLimit).toLocaleString() }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="block-list-card">
      <template #header>
        <div class="card-header">
          <span>⛓️ 链上最新区块</span>
          <el-button icon="Refresh" circle @click="fetchBlockData" :loading="loading" />
        </div>
      </template>
      
      <el-table :data="blocks" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="number" label="高度" width="100">
          <template #default="scope">
            <el-tag effect="dark">#{{ scope.row.number }}</el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="hash" label="区块哈希 (点击查看详情)" min-width="200">
          <template #default="scope">
            <el-link 
              type="primary" 
              :underline="false" 
              class="mono-font" 
              @click="handleBlockClick(scope.row.hash)"
            >
              {{ scope.row.hash }}
            </el-link>
          </template>
        </el-table-column>

        <el-table-column prop="timestamp" label="出块时间" width="180">
          <template #default="scope">
            {{ new Date(Number(scope.row.timestamp) * 1000).toLocaleTimeString() }}
          </template>
        </el-table-column>
        <el-table-column label="交易数" width="120">
          <template #default="scope">
            {{ scope.row.transactions.length }} Txs
          </template>
        </el-table-column>
        <el-table-column prop="gasUsed" label="Gas 消耗" width="120">
          <template #default="scope">
            <span style="font-family: monospace">{{ scope.row.gasUsed }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-dialog v-model="dialogVisible" title="📦 区块详情信息" width="650px" destroy-on-close>
      <div v-loading="loadingBlock">
        <div v-if="selectedBlock">
          <el-descriptions border :column="1" size="large" class="block-desc">
            <el-descriptions-item label="区块高度">
              <el-tag>#{{ selectedBlock.number }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="区块哈希">
              <span class="mono-font small">{{ selectedBlock.hash }}</span>
              <el-button link type="primary" :icon="DocumentCopy" @click="copyHash(selectedBlock.hash)" />
            </el-descriptions-item>
            <el-descriptions-item label="父区块哈希">
              <span class="mono-font small">{{ selectedBlock.parentHash }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="出块时间">
              {{ new Date(Number(selectedBlock.timestamp) * 1000).toLocaleString() }}
            </el-descriptions-item>
            <el-descriptions-item label="矿工地址">
              <span class="mono-font">{{ selectedBlock.miner }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="Gas 消耗">
              {{ selectedBlock.gasUsed }} / {{ selectedBlock.gasLimit }}
            </el-descriptions-item>
            <el-descriptions-item label="包含交易">
               <div v-if="selectedBlock.transactions && selectedBlock.transactions.length > 0">
                 <div v-for="tx in selectedBlock.transactions" :key="tx" class="tx-item">
                   <el-icon><Link /></el-icon>
                   <span class="mono-font small">{{ tx }}</span>
                   <el-button link type="primary" :icon="DocumentCopy" @click="copyHash(tx)">复制</el-button>
                 </div>
               </div>
               <div v-else style="color: #999; font-style: italic;">无交易</div>
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import axios from 'axios'; 
import { ElMessage } from 'element-plus';
// 引入 DocumentCopy 图标
import { Odometer, Money, UserFilled, ScaleToOriginal, Refresh, Link, DocumentCopy } from '@element-plus/icons-vue';

const loading = ref(false);
const blockNumber = ref(0);
const chainId = ref(0);
const gasPrice = ref('0');
const miner = ref('');
const gasLimit = ref(0);
const blocks = ref<any[]>([]);
let timer: any = null;

// 弹窗相关
const dialogVisible = ref(false);
const loadingBlock = ref(false);
const selectedBlock = ref<any>(null);

const formatAddress = (addr: string) => addr ? `${addr.substring(0, 8)}...${addr.substring(addr.length - 6)}` : 'Unknown';

// === 核心修改：兼容 HTTP 环境的复制函数 ===
const copyHash = (hash: string) => {
  if (!hash) return;
  
  // 1. 尝试标准 API (仅 HTTPS/Localhost)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(hash).then(() => {
      ElMessage.success('复制成功');
    }).catch(() => {
      ElMessage.error('复制失败');
    });
  } else {
    // 2. 兼容模式 (支持 HTTP)
    const input = document.createElement('input');
    input.value = hash;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.focus();
    input.select();
    try {
      document.execCommand('copy');
      ElMessage.success('复制成功');
    } catch (e) {
      ElMessage.error('复制失败，请手动复制');
    }
    document.body.removeChild(input);
  }
};

// 获取列表
const fetchBlockData = async () => {
  loading.value = true;
  try {
    const token = localStorage.getItem('token');
    const res = await axios.get('/api/admin/chain-status', {
      headers: { 'x-auth-token': token }
    });

    const data = res.data;
    blockNumber.value = data.blockNumber;
    chainId.value = data.chainId;
    gasPrice.value = data.gasPrice;
    miner.value = data.miner;
    gasLimit.value = data.gasLimit;
    blocks.value = data.blocks;

  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
};

// 点击区块哈希
const handleBlockClick = async (hash: string) => {
  dialogVisible.value = true;
  loadingBlock.value = true;
  selectedBlock.value = null;

  try {
    const token = localStorage.getItem('token');
    const res = await axios.get(`/api/admin/block/${hash}`, {
      headers: { 'x-auth-token': token }
    });
    selectedBlock.value = res.data;
  } catch (error: any) {
    ElMessage.error("获取区块详情失败");
    dialogVisible.value = false;
  } finally {
    loadingBlock.value = false;
  }
};

onMounted(() => {
  fetchBlockData();
  timer = setInterval(fetchBlockData, 5000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.monitor-container { padding: 20px; }
.dashboard-cards { margin-bottom: 20px; }
.data-card { display: flex; align-items: center; padding: 10px; }
.data-card :deep(.el-card__body) { display: flex; align-items: center; width: 100%; padding: 10px; }
.card-icon { width: 50px; height: 50px; border-radius: 12px; display: flex; justify-content: center; align-items: center; font-size: 24px; color: white; margin-right: 15px; }
.blue { background: linear-gradient(135deg, #36d1dc, #5b86e5); }
.green { background: linear-gradient(135deg, #42e695, #3bb2b8); }
.orange { background: linear-gradient(135deg, #ffc371, #ff5f6d); }
.purple { background: linear-gradient(135deg, #a18cd1, #fbc2eb); }
.card-info { flex: 1; overflow: hidden; }
.label { color: #909399; font-size: 13px; margin-bottom: 5px; }
.value { color: #303133; font-size: 20px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.address-font { font-family: monospace; font-size: 16px; }
.block-list-card { margin-bottom: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
.mono-font { font-family: monospace; font-size: 13px; color: #606266; }
.mono-font.small { font-size: 12px; }
.tx-info { display: flex; align-items: center; }
.network-params { margin-top: 20px; }

/* 弹窗样式 */
.tx-item { margin-bottom: 8px; display: flex; align-items: center; gap: 10px; }
.block-desc :deep(.el-descriptions__label) { width: 120px; font-weight: bold; background: #fafafa; }
</style>