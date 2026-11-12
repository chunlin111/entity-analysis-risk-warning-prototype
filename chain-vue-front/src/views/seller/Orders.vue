<template>
  <div class="seller-orders-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>📜 发布的电力合约状态</span>
          <div class="header-actions">
             <el-tag type="info" style="margin-right: 10px">共 {{ productList.length }} 条记录</el-tag>
             <el-button icon="Refresh" circle @click="fetchData" />
          </div>
        </div>
      </template>

      <el-table :data="productList" stripe style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        
        <el-table-column label="电力类型" width="100">
          <template #default="scope">
            <el-tag :type="getTypeColor(scope.row.type)">{{ scope.row.type }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="amount" label="数量 (MWh)" width="110" />
        <el-table-column label="单价" width="110">
          <template #default="scope">¥ {{ scope.row.price }}</template>
        </el-table-column>

        <el-table-column label="合约流转状态" width="140">
          <template #default="scope">
            <el-tag v-if="scope.row.status === 0" type="info" effect="light">
              <el-icon><Timer /></el-icon> 等待审核
            </el-tag>
            
            <el-tag v-else-if="scope.row.status === 1" type="primary" effect="light">
              <el-icon><Shop /></el-icon> 正在销售
            </el-tag>
            
            <el-tag v-else-if="scope.row.status === 2" type="danger" effect="plain">
              <el-icon><CircleClose /></el-icon> 审核拒绝
            </el-tag>
            
            <el-tag v-else-if="scope.row.status === 3" type="success" effect="dark">
              <el-icon><CircleCheckFilled /></el-icon> 交易完成
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="发布存证 (Tx Hash)" min-width="180">
          <template #default="scope">
             <el-tooltip content="点击复制完整哈希，可用于区块链浏览器查证" placement="top">
              <el-link type="info" :underline="false" @click="copyHash(scope.row.tx_hash)" style="font-family: monospace;">
                <el-icon style="margin-right:4px"><Link /></el-icon> 
                {{ formatHash(scope.row.tx_hash) }}
              </el-link>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column label="最近更新时间" width="170">
          <template #default="scope">
            <span style="font-size: 12px; color: #909399">
              {{ new Date(scope.row.updatedAt).toLocaleString() }}
            </span>
          </template>
        </el-table-column>
      </el-table>
      
      <el-empty v-if="!loading && productList.length === 0" description="您还没有发布过任何资源，快去“上架电力资源”页面发布吧！" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { 
  Link, Refresh, Timer, Shop, CircleClose, CircleCheckFilled 
} from '@element-plus/icons-vue';

interface Product {
  id: number;
  type: string;
  amount: number;
  price: number;
  status: number; // 0, 1, 2, 3
  tx_hash: string;
  updatedAt: string;
}

const loading = ref(false);
const productList = ref<Product[]>([]);

// 辅助函数：电力类型颜色
const getTypeColor = (type: string) => {
  const map: Record<string, string> = { '风电': '', '光电': 'warning', '水电': 'success', '火电': 'danger' };
  return map[type] || 'info';
};

// 辅助函数：格式化哈希
const formatHash = (hash: string) => {
  if (!hash) return '未上链';
  return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`;
};

// 复制功能
// 兼容 HTTP 环境的复制函数
const copyHash = (hash: string | null) => {
  if (!hash) return;

  // 1. 尝试使用标准 API (仅限 localhost 或 HTTPS)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(hash).then(() => {
      ElMessage.success('哈希已复制');
    }).catch(() => {
      ElMessage.error('复制失败');
    });
  } else {
    // 2. 兼容模式：使用 input 元素选中复制 (支持 HTTP)
    try {
      const input = document.createElement('input');
      input.value = hash;
      // 将输入框移出可视区域，避免影响界面
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.style.top = '0';
      document.body.appendChild(input);
      
      input.focus();
      input.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(input);
      
      if (successful) {
        ElMessage.success('哈希已复制');
      } else {
        ElMessage.error('浏览器不支持自动复制，请手动选中');
      }
    } catch (err) {
      console.error('Fallback copy failed', err);
      ElMessage.error('复制失败');
    }
  }
};

// 核心：从后端获取数据
const fetchData = async () => {
  loading.value = true;
  try {
    const token = localStorage.getItem('token');
    // 调用之前写好的获取我的发布列表接口
    const res = await axios.get('/api/products/my-products', {
      headers: { 'x-auth-token': token }
    });
    productList.value = res.data;
  } catch (error) {
    console.error(error);
    ElMessage.error("数据加载失败，请检查后端服务");
  } finally {
    loading.value = false;
  }
};

// 页面加载时自动拉取
onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.seller-orders-container { padding: 0; }
.card-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 16px; }
.header-actions { display: flex; align-items: center; }
</style>