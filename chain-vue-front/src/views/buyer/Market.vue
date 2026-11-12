<template>
  <div class="market-container">
    <el-card class="filter-card">
      <div class="filter-header">
        <span class="title">⚡ 电力交易广场 (买家版)</span>
        <div class="search-box">
          <el-input v-model="searchText" placeholder="搜索发布者或描述..." prefix-icon="Search" clearable />
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
                <span class="value seller-name">{{ formatSeller(item.seller?.username || item.seller?.email) }}</span>
              </div>
              <div class="desc">{{ item.description || '暂无描述' }}</div>
            </div>

            <div class="card-footer">
              <div class="time">{{ formatDate(item.updatedAt) }}</div>
              <el-button type="primary" size="small" @click="handleBuy(item)">立即购买</el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-empty v-if="!loading && filteredList.length === 0" description="暂无符合条件的电力资源" />
    </div>

    <el-dialog v-model="dialogVisible" title="✍️ 签署购买合约" width="450px">
      <div v-if="selectedItem" class="confirm-box">
        <el-descriptions border :column="1">
          <el-descriptions-item label="商品类型">{{ selectedItem.type }}</el-descriptions-item>
          <el-descriptions-item label="购买数量">{{ selectedItem.amount }} MWh</el-descriptions-item>
          <el-descriptions-item label="需支付">
            <span style="color: #f56c6c; font-weight: bold">
               {{ (selectedItem.price * selectedItem.amount).toFixed(2) }} 元
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="卖家">
             <span class="addr-text">{{ selectedItem.seller?.username }}</span>
          </el-descriptions-item>
        </el-descriptions>
        
        <div class="sign-area">
           <p style="text-align:center; color:#67C23A; font-size:13px; margin-top:15px">
             <el-icon style="vertical-align:middle"><InfoFilled /></el-icon> 交易费用由平台代付，您无需支付 Gas。
           </p>
        </div>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmPurchase" :loading="submitting">
          确认支付并上链
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { Search, InfoFilled } from '@element-plus/icons-vue'; 

// 定义接口
interface Product {
  id: number;
  type: string;
  amount: number;
  price: number;
  description: string;
  updatedAt: string;
  tx_hash: string;
  // seller 可能是 undefined，里面的字段也可能是 undefined
  seller?: { email?: string; username?: string };
}

// 状态变量
const loading = ref(false);
const submitting = ref(false);
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

// === 修复点：允许参数为 undefined (加个问号) ===
const formatSeller = (name?: string) => {
  return name || '未知卖家';
};

const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

// 1. 获取商品列表
const fetchProducts = async () => {
  loading.value = true;
  try {
    const token = localStorage.getItem('token');
    const res = await axios.get('/api/products/list', {
      headers: { 'x-auth-token': token }
    });
    productList.value = res.data;
  } catch (error) {
    ElMessage.error("获取商品列表失败");
  } finally {
    loading.value = false;
  }
};

// 2. 筛选逻辑
const filteredList = computed(() => {
  return productList.value.filter(item => {
    const matchType = typeFilter.value === 'ALL' || item.type === typeFilter.value;
    
    // 安全获取字符串，防止 undefined 报错
    const sellerEmail = item.seller?.email || '';
    const desc = item.description || '';
    
    const matchText = !searchText.value || 
      sellerEmail.includes(searchText.value) || 
      desc.includes(searchText.value);
      
    return matchType && matchText;
  });
});

// 3. 点击购买按钮
const handleBuy = (item: Product) => {
  selectedItem.value = item;
  dialogVisible.value = true;
};

// 4. 确认购买并上链
const confirmPurchase = async () => {
  if (!selectedItem.value) return;
  submitting.value = true;
  
  try {
    const token = localStorage.getItem('token');
    await axios.post('/api/orders/create', {
      product_id: selectedItem.value.id
    }, {
      headers: { 'x-auth-token': token }
    });

    ElMessage.success("购买成功！平台已为您完成链上确权");
    dialogVisible.value = false;
    fetchProducts();
  } catch (error: any) {
    ElMessage.error("交易失败: " + (error.response?.data?.msg || error.message));
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  fetchProducts();
});
</script>

<style scoped>
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

.addr-text { font-size: 12px; word-break: break-all; font-family: monospace; }
</style>