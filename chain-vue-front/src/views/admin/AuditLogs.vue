<template>
    <div class="logs-container">
      <el-card>
        <template #header>
          <div class="card-header">
            <span>🛡️ 系统审计日志</span>
            <el-tag type="info">日志保留期：6个月</el-tag>
          </div>
        </template>
  
        <el-form :inline="true" :model="filters" class="demo-form-inline">
          <el-form-item label="操作人">
            <el-input v-model="filters.username" placeholder="用户名" clearable />
          </el-form-item>
          <el-form-item label="事件类型">
            <el-select v-model="filters.action" placeholder="全部类型" clearable style="width: 200px">
              <el-option-group label="认证安全">
                <el-option label="用户登录 (LOGIN)" value="LOGIN" />
                <el-option label="重置密码 (RESET_PASSWORD)" value="RESET_PASSWORD" />
              </el-option-group>

              <el-option-group label="管理审计">
                <el-option label="审核用户 (ADMIN_VERIFY_USER)" value="ADMIN_VERIFY_USER" />
                <el-option label="审核商品 (AUDIT_PRODUCT)" value="AUDIT_PRODUCT" />
              </el-option-group>

              <el-option-group label="电力交易">
                <el-option label="发布商品 (PUBLISH_PRODUCT)" value="PUBLISH_PRODUCT" />
                <el-option label="创建订单 (CREATE_ORDER)" value="CREATE_ORDER" />
              </el-option-group>
            </el-select>
          </el-form-item>
          <el-form-item label="时间范围">
            <el-date-picker
              v-model="filters.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="fetchLogs">查询</el-button>
          </el-form-item>
        </el-form>
  
        <el-table :data="logs" style="width: 100%" v-loading="loading" stripe border>
          <el-table-column prop="createdAt" label="日期时间" width="180">
            <template #default="scope">
              {{ formatTime(scope.row.createdAt) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="operatorName" label="操作用户" width="150" />
          
          <el-table-column prop="action" label="事件类型" width="120">
            <template #default="scope">
              <el-tag :type="getActionType(scope.row.action)">{{ scope.row.action }}</el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="details" label="事件详情" show-overflow-tooltip />
          
          <el-table-column prop="ipAddress" label="IP地址" width="140" />
          
          <el-table-column prop="status" label="状态" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.status === 'SUCCESS' ? 'success' : 'danger'" effect="dark">
                {{ scope.row.status === 'SUCCESS' ? '成功' : '失败' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
  
        <div class="pagination">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            :total="total"
            @size-change="fetchLogs"
            @current-change="fetchLogs"
          />
        </div>
      </el-card>
    </div>
  </template>
  
  <script setup>
  import { ref, reactive, onMounted } from 'vue';
  import axios from 'axios';
  import { ElMessage } from 'element-plus';
  
  const logs = ref([]);
  const total = ref(0);
  const currentPage = ref(1);
  const pageSize = ref(20);
  const loading = ref(false);
  
  const filters = reactive({
    username: '',
    action: '',
    dateRange: []
  });
  
  const formatTime = (timeStr) => {
    return new Date(timeStr).toLocaleString();
  };
  
  const getActionType = (action) => {
      switch (action) {
      // 绿色：成功/正面操作
      case 'LOGIN':
      case 'REGISTER':
      case 'SUCCESS':
        return 'success';
      
      // 橙色：重要修改/业务操作
      case 'RESET_PASSWORD':
      case 'PUBLISH_PRODUCT':
      case 'CREATE_ORDER':
        return 'warning';
        
      // 蓝色：管理员操作
      case 'ADMIN_VERIFY_USER':
      case 'AUDIT_PRODUCT':
        return ''; // 默认蓝色
        
      // 红色：失败/危险
      case 'FAIL':
        return 'danger';
        
      // 灰色：其他
      default:
        return 'info';
    }
  };
  
  const fetchLogs = async () => {
    loading.value = true;
    try {
      const params = {
        page: currentPage.value,
        pageSize: pageSize.value,
        username: filters.username,
        action: filters.action,
      };
      
      if (filters.dateRange && filters.dateRange.length === 2) {
        params.startDate = filters.dateRange[0];
        params.endDate = filters.dateRange[1];
      }
  
      const res = await axios.get('/api/admin/logs', { params });
      logs.value = res.data.list;
      total.value = res.data.total;
    } catch (err) {
      ElMessage.error('日志加载失败');
    } finally {
      loading.value = false;
    }
  };
  
  onMounted(() => {
    fetchLogs();
  });
  </script>
  
  <style scoped>
  .card-header { display: flex; justify-content: space-between; align-items: center; }
  .pagination { margin-top: 20px; text-align: right; }
  </style>