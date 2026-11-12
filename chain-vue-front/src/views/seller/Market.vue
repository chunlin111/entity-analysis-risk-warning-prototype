<template>
  <div class="market-container">
    <el-card class="filter-card">
      <div class="filter-header">
        <span class="title">📈 市场行情 (仅浏览)</span>
        <div class="search-box">
          <el-input v-model="searchText" placeholder="搜索资源..." prefix-icon="Search" clearable />
        </div>
      </div>
      <div class="type-tabs">
        <el-radio-group v-model="typeFilter" size="large">
          <el-radio-button label="ALL">全部</el-radio-button>
          <el-radio-button label="风电">🌬️ 风电</el-radio-button>
          <el-radio-button label="光电">☀️ 光电</el-radio-button>
          <el-radio-button label="水电">💧 水电</el-radio-button>
          <el-radio-button label="火电">🔥 火电</el-radio-button>
        </el-radio-group>
      </div>
    </el-card>

    <div class="product-list" v-loading="loading">
      <el-row :gutter="20">
        <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="item in filteredList" :key="item.id">
          <el-card class="product-card" shadow="hover">
            <div class="card-header">
              <el-tag :type="getTypeColor(item.type)" effect="dark">{{ item.type }}</el-tag>
              <span class="price">¥{{ item.price }} <span class="unit">/ MWh</span></span>
            </div>
            
            <div class="card-content">
              <div class="info-row">
                <span class="label">供应量:</span>
                <span class="value highlight">{{ item.amount }} MWh</span>
              </div>
              <div class="info-row">
                <span class="label">卖家:</span>
                <span class="value seller-name">{{ formatSeller(item.seller?.email) }}</span>
              </div>
              <div class="desc">{{ item.description || '暂无描述' }}</div>
            </div>

            <div class="card-footer">
              <div class="time">{{ formatDate(item.updatedAt) }}</div>
              <el-button type="info" plain size="small" @click="handleView(item)">查看详情</el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-empty v-if="!loading && filteredList.length === 0" description="暂无市场数据" />
    </div>

    <el-dialog v-model="dialogVisible" title="资源详情" width="400px">
      <div v-if="selectedItem">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="电力类型">{{ selectedItem.type }}</el-descriptions-item>
          <el-descriptions-item label="供应数量">{{ selectedItem.amount }} MWh</el-descriptions-item>
          <el-descriptions-item label="单价">{{ selectedItem.price }} 元/MWh</el-descriptions-item>
          <el-descriptions-item label="发布时间">{{ formatDate(selectedItem.updatedAt) }}</el-descriptions-item>
          <el-descriptions-item label="卖家地址">
            <span style="font-size: 12px; font-family: monospace">{{ selectedItem.seller?.username }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="存证哈希">
            <el-link type="primary" :underline="false" style="font-size: 12px">{{ formatHash(selectedItem.tx_hash) }}</el-link>
          </el-descriptions-item>
        </el-descriptions>
        <div style="margin-top: 15px; color: #666; font-size: 14px;">
          <strong>描述：</strong> {{ selectedItem.description }}
        </div>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
// 修复 1: 引入 Search 图标
import { Search } from '@element-plus/icons-vue';

// 数据接口定义
interface Product {
  id: number;
  type: string;
  amount: number;
  price: number;
  description: string;
  updatedAt: string;
  tx_hash: string;
  seller?: { email: string; username: string };
}

const loading = ref(false);
const productList = ref<Product[]>([]);
const searchText = ref('');
const typeFilter = ref('ALL');
const dialogVisible = ref(false);
const selectedItem = ref<Product | null>(null);

// 辅助函数
const getTypeColor = (type: string) => {
  const map: Record<string, string> = { '风电': '', '光电': 'warning', '水电': 'success', '火电': 'danger' };
  return map[type] || 'info';
};

// 修复 2: 允许参数为 undefined (email?: string)
const formatSeller = (email?: string) => {
  return email ? email.split('@')[0] : '未知';
};

const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();
const formatHash = (hash: string) => hash ? `${hash.substring(0, 10)}...${hash.substring(hash.length - 10)}` : '无';

// 获取数据
const fetchProducts = async () => {
  loading.value = true;
  try {
    const token = localStorage.getItem('token');
    const res = await axios.get('/api/products/list', {
      headers: { 'x-auth-token': token }
    });
    productList.value = res.data;
  } catch (error) {
    ElMessage.error("获取数据失败，请确保后端运行正常");
  } finally {
    loading.value = false;
  }
};

// 筛选逻辑
const filteredList = computed(() => {
  return productList.value.filter(item => {
    const matchType = typeFilter.value === 'ALL' || item.type === typeFilter.value;
    
    // 修复 3: 增加空值检查，防止 seller 为空时 includes 报错
    const sellerEmail = item.seller?.email || '';
    const desc = item.description || '';

    const matchText = !searchText.value || 
      sellerEmail.includes(searchText.value) || 
      desc.includes(searchText.value);
      
    return matchType && matchText;
  });
});

// 查看详情
const handleView = (item: Product) => {
  selectedItem.value = item;
  dialogVisible.value = true;
};

onMounted(() => {
  fetchProducts();
});
</script>

<style scoped>
/* 保持和买家端一致的样式 */
.market-container { padding: 0; }
.filter-card { margin-bottom: 20px; border-radius: 8px; }
.filter-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.title { font-size: 18px; font-weight: bold; color: #303133; }
.search-box { width: 300px; }
.product-card { margin-bottom: 20px; border-radius: 12px; transition: all 0.3s; border: none; background: #fff; }
.product-card:hover { transform: translateY(-5px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.price { font-size: 20px; font-weight: bold; color: #f56c6c; }
.unit { font-size: 12px; color: #909399; font-weight: normal; }
.card-content { margin-bottom: 15px; font-size: 14px; color: #606266; }
.info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
.label { color: #909399; }
.highlight { font-weight: bold; color: #409EFF; }
.seller-name { color: #606266; }
.desc { margin-top: 10px; color: #909399; font-size: 12px; height: 36px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f0f0f0; padding-top: 12px; }
.time { font-size: 12px; color: #c0c4cc; }
</style>