<template>
  <div class="publish-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>🚀 上架电力资源</span>
          <el-tag type="info">平台代付 Gas • 自动存证</el-tag>
        </div>
      </template>

      <el-form :model="form" label-width="100px" style="max-width: 600px">
        <el-form-item label="电力类型">
          <el-select v-model="form.type" placeholder="请选择类型" style="width: 100%">
            <el-option label="🌬️ 风电 (Wind)" value="风电" />
            <el-option label="☀️ 光电 (Solar)" value="光电" />
            <el-option label="💧 水电 (Hydro)" value="水电" />
            <el-option label="🔥 火电 (Thermal)" value="火电" />
          </el-select>
        </el-form-item>

        <el-form-item label="供应数量">
          <el-input v-model="form.amount" type="number" placeholder="单位：MWh">
            <template #append>MWh</template>
          </el-input>
        </el-form-item>

        <el-form-item label="期望单价">
          <el-input v-model="form.price" type="number" placeholder="单位：CNY/MWh">
            <template #append>元</template>
          </el-input>
        </el-form-item>

        <el-form-item label="资源描述">
          <el-input v-model="form.description" type="textarea" rows="3" placeholder="例如：位于内蒙古风电基地，预计下月供电..." />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="openConfirm">
            立即发布
          </el-button>
          <div class="tip">发布后需通过平台审核方可交易</div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-dialog v-model="dialogVisible" title="确认发布信息" width="400px">
      <div class="confirm-content">
        <p>请确认以下信息无误，系统将自动上链存证：</p>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="类型">{{ form.type }}</el-descriptions-item>
          <el-descriptions-item label="数量">{{ form.amount }} MWh</el-descriptions-item>
          <el-descriptions-item label="单价">{{ form.price }} 元</el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitPublish" :loading="loading">
            确认提交
          </el-button>
        </span>
      </template>
    </el-dialog>

    <el-card style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>📦 我的发布记录</span>
          <el-button icon="Refresh" circle size="small" @click="fetchMyProducts" />
        </div>
      </template>
      
      <el-table :data="myProducts" stripe height="250px">
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column prop="amount" label="数量" />
        <el-table-column prop="price" label="价格" />
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag v-if="scope.row.status === 0" type="info">⏳ 待审核</el-tag>
            <el-tag v-else-if="scope.row.status === 1" type="success">✅ 销售中</el-tag>
            <el-tag v-else-if="scope.row.status === 2" type="danger">❌ 已拒绝</el-tag>
            <el-tag v-else-if="scope.row.status === 3" type="warning">🎉 已售出</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';

const loading = ref(false);
const dialogVisible = ref(false); // 控制弹窗显示
const myProducts = ref([]);

const form = ref({
  type: '',
  amount: '',
  price: '',
  description: ''
});

// 1. 打开确认弹窗
const openConfirm = () => {
  if (!form.value.type || !form.value.amount || !form.value.price) {
    return ElMessage.warning("请填写完整信息");
  }
  dialogVisible.value = true; // 显示弹窗
};

// 2. 提交发布 (后端自动上链)
const submitPublish = async () => {
  loading.value = true;

  try {
    const token = localStorage.getItem('token');
    
    // 调用后端接口
    await axios.post('/api/products/publish', form.value, {
      headers: { 'x-auth-token': token }
    });

    ElMessage.success("发布成功！已自动存证并提交审核");
    
    // === 核心修复：在这里关闭弹窗 ===
    dialogVisible.value = false; 
    // ============================

    // 重置表单
    form.value = { type: '', amount: '', price: '', description: '' };
    
    // 刷新下方列表
    fetchMyProducts();

  } catch (error: any) {
    ElMessage.error((error.response?.data?.msg || error.message));
  } finally {
    loading.value = false;
  }
};

// 获取我的历史记录
const fetchMyProducts = async () => {
  try {
    const token = localStorage.getItem('token');
    const res = await axios.get('/api/products/my-products', {
        headers: { 'x-auth-token': token }
    });
    myProducts.value = res.data;
  } catch (error) {
    console.error(error);
  }
}

onMounted(() => {
  fetchMyProducts();
});
</script>

<style scoped>
.publish-container { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
.tip { font-size: 12px; color: #909399; margin-left: 10px; display: inline-block; }
.confirm-content { margin-bottom: 20px; }
</style>