<template>
  <div class="audit-container">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>⚖️ 待审核商品列表</span>
          <el-button icon="Refresh" circle @click="fetchPendingProducts" />
        </div>
      </template>

      <el-table :data="pendingList" stripe style="width: 100%" v-loading="loadingProducts">
        <el-table-column prop="id" label="商品ID" width="80" />
        <el-table-column label="电力类型" width="120">
          <template #default="scope">
            <el-tag :type="getTypeColor(scope.row.type)">{{ scope.row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="数量 (MWh)" width="120" />
        <el-table-column label="卖家信息" min-width="180">
          <template #default="scope">
            <div><strong>{{ scope.row.seller?.username }}</strong></div>
            <div style="font-size:12px; color:#999">{{ scope.row.seller?.email }}</div>
          </template>
        </el-table-column>
        
        <el-table-column label="用户状态" width="100">
          <template #default="scope">
            <el-tag v-if="scope.row.seller?.isVerified" type="success">已认证</el-tag>
            <el-tag v-else type="danger">未认证</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="链上存证 (Tx Hash)" min-width="150">
          <template #default="scope">
            <el-tooltip content="点击复制完整哈希" placement="top">
              <el-tag type="info" style="cursor: pointer" @click="copyHash(scope.row.tx_hash)">
                <el-icon><Link /></el-icon> {{ formatHash(scope.row.tx_hash) }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <el-button type="success" size="small" @click="handleAuditProduct(scope.row.id, 'approve')">通过</el-button>
            <el-button type="danger" size="small" @click="handleAuditProduct(scope.row.id, 'reject')">拒绝</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loadingProducts && pendingList.length === 0" description="暂无待审核商品" />
    </el-card>

    <el-card class="box-card" style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>🛡️ 待认证用户列表</span>
          <el-button icon="Refresh" circle @click="fetchUnverifiedUsers" />
        </div>
      </template>
      <el-table :data="unverifiedUsers" stripe style="width: 100%" v-loading="loadingUsers">
        <el-table-column prop="id" label="用户ID" width="80" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="email" label="邮箱" />
        <el-table-column label="用户类型" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.role === 1" type="warning">商家</el-tag>
            <el-tag v-else-if="scope.row.role === 2" type="success">买家</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="实体类型" width="120">
          <template #default="scope">
            {{ getEntityLabel(scope.row.userType) }}
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="180">
          <template #default="scope">
            {{ new Date(scope.row.createdAt).toLocaleDateString() }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" @click="handleVerifyUser(scope.row.id)">通过认证</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loadingUsers && unverifiedUsers.length === 0" description="所有用户均已认证" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { Link, Refresh } from '@element-plus/icons-vue';

// --- 状态定义 ---
interface Seller { id: number; username: string; email: string; isVerified: boolean; }
interface Product { id: number; type: string; amount: number; tx_hash: string; seller?: Seller; }
interface User { id: number; username: string; email: string; role: number; userType: number; createdAt: string; }

const loadingProducts = ref(false);
const loadingUsers = ref(false);
const pendingList = ref<Product[]>([]);
const unverifiedUsers = ref<User[]>([]);

// --- 辅助函数 ---
const entityLabels: Record<string, string> = { '0': '居民', '1': '商业', '2': '工业', 'null': '未指定' };
const getEntityLabel = (label: number) => entityLabels[String(label)] || '未指定';
const getTypeColor = (type: string) => {
  const map: Record<string, string> = { '风电': '', '光电': 'warning', '水电': 'primary', '火电': 'danger' };
  return map[type] || 'info';
};
const formatHash = (hash: string) => hash ? `${hash.substring(0, 10)}...${hash.substring(hash.length - 10)}` : 'N/A';
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

// --- API 1: 获取待审核商品 (已修复缓存) ---
const fetchPendingProducts = async () => {
  loadingProducts.value = true;
  console.log("--- [FRONTEND DEBUG] 1. (fetchPendingProducts) 正在调用 /api/products/pending ---");
  try {
    const token = localStorage.getItem('token');
    
    // === 核心修复：添加 params 来禁用 GET 缓存 ===
    const res = await axios.get('/api/products/pending', {
      headers: { 'x-auth-token': token },
      params: { _t: new Date().getTime() } // 添加时间戳
    });

    console.log("--- [FRONTEND DEBUG] 2. (fetchPendingProducts) 收到原始数据: ---");
    console.log(JSON.stringify(res.data, null, 2));

    pendingList.value = res.data;
  } catch (error: any) {
    console.error("--- [FRONTEND DEBUG] 3. (fetchPendingProducts) 请求失败! ---", error);
    ElMessage.error("获取商品列表失败");
  } finally {
    loadingProducts.value = false;
  }
};

// --- API 2: 获取未认证用户 (已修复缓存) ---
const fetchUnverifiedUsers = async () => {
  loadingUsers.value = true;
  try {
    const token = localStorage.getItem('token');

    // === 核心修复：添加 params 来禁用 GET 缓存 ===
    const res = await axios.get('/api/admin/unverified-users', {
      headers: { 'x-auth-token': token },
      params: { _t: new Date().getTime() } // 添加时间戳
    });
    unverifiedUsers.value = res.data;
  } catch (error: any) {
    ElMessage.error("获取用户列表失败");
  } finally {
    loadingUsers.value = false;
  }
};

// --- API 3: 审核商品 ---
const handleAuditProduct = async (id: number, action: 'approve' | 'reject') => {
  try {
    const token = localStorage.getItem('token');
    await axios.post('/api/products/audit', { productId: id, action }, {
      headers: { 'x-auth-token': token }
    });
    ElMessage.success(action === 'approve' ? '商品已通过' : '商品已拒绝');
    fetchPendingProducts(); // 刷新商品列表
  } catch (error: any) {
    ElMessage.error("操作失败");
  }
};

// --- API 4: 认证用户 ---
const handleVerifyUser = async (userId: number) => {
  try {
    const token = localStorage.getItem('token');
    await axios.post('/api/admin/verify-user', { userId }, {
      headers: { 'x-auth-token': token }
    });
    ElMessage.success('用户认证成功');
    
    // 同时刷新两个列表
    fetchUnverifiedUsers(); 
    fetchPendingProducts(); 
  } catch (error: any) {
    ElMessage.error('认证失败');
  }
}

// --- 初始化 ---
onMounted(() => {
  fetchPendingProducts();
  fetchUnverifiedUsers();
});
</script>

<style scoped>
.audit-container { padding: 20px; }
.box-card { border-radius: 8px; }
.card-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 16px; }
</style>