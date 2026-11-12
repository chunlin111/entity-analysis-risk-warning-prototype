<template>
  <div class="orders-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>📋 我的合约订单</span>
          <el-button icon="Refresh" circle @click="fetchOrders" />
        </div>
      </template>

      <el-table :data="orderList" stripe style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="订单号" width="80" />
        
        <el-table-column label="商品信息" min-width="180">
          <template #default="scope">
            <div style="font-weight:bold">{{ scope.row.product?.type }} 电力</div>
            <div style="font-size:12px; color:#999">{{ scope.row.product?.amount }} MWh</div>
          </template>
        </el-table-column>

        <el-table-column label="交易金额" width="120">
          <template #default="scope">
            <span style="color: #f56c6c">¥{{ scope.row.total_price }}</span>
          </template>
        </el-table-column>

        <el-table-column label="链上凭证 (Tx Hash)" min-width="200">
          <template #default="scope">
            <el-tooltip content="点击复制凭证" placement="top">
              <el-tag type="success" style="cursor: pointer" @click="copyHash(scope.row.tx_hash)">
                <el-icon><Link /></el-icon> {{ formatHash(scope.row.tx_hash) }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column label="下单时间" width="180">
          <template #default="scope">
            {{ new Date(scope.row.createdAt).toLocaleString() }}
          </template>
        </el-table-column>
        
        <el-table-column label="状态" width="100">
          <template #default>
            <el-tag type="success" effect="plain">已完成</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && orderList.length === 0" description="暂无订单，快去交易广场看看吧" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { Link, Refresh } from '@element-plus/icons-vue';

const loading = ref(false);
const orderList = ref([]);

const formatHash = (hash: string) => hash ? `${hash.substring(0, 10)}...${hash.substring(hash.length - 10)}` : '';

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

const fetchOrders = async () => {
  loading.value = true;
  try {
    const token = localStorage.getItem('token');
    const res = await axios.get('/api/orders/my-orders', {
      headers: { 'x-auth-token': token }
    });
    orderList.value = res.data;
  } catch (error) {
    ElMessage.error("获取订单失败");
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchOrders();
});
</script>

<style scoped>
.orders-container { padding: 0; }
.card-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
</style>