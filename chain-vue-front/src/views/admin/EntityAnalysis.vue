<template>
  <div class="page-container dashboard-container">
    <el-row :gutter="20">
      <el-col :span="16">
        <el-card class="box-card">
          <template #header>
            <div class="card-header">
              <span>发电与交易趋势 (近7日)</span>
              <el-tag type="success" effect="plain" v-if="!loading">
                <el-icon class="is-loading" style="vertical-align: middle; margin-right: 4px"><Refresh /></el-icon>
                自动刷新中
              </el-tag>
              <el-tag type="info" effect="plain" v-else>
                <el-icon class="is-loading"><Refresh /></el-icon>
                正在加载...
              </el-tag>
            </div>
          </template>
          <div ref="lineChartRef" style="height: 280px; width: 100%;"></div>
        </el-card>

        <el-card class="box-card" style="margin-top: 20px">
          <template #header><span>分析数据明细 (最近100条)</span></template>
          <el-table :data="tableData" stripe height="350px" v-loading="loading">
            <el-table-column prop="id" label="分析ID" width="70" />
            <el-table-column prop="user_id" label="用户ID" width="70" />
            <el-table-column label="真实样本类型" width="140">
              <template #default="scope">
                <el-tag :type="getEntityTag(scope.row.userType)">{{ getEntityLabel(scope.row.userType) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="AI预测" width="100">
              <template #default="scope">
                <el-tag :type="getEntityTag(scope.row.pred_entity_label)" effect="dark">
                  {{ getEntityLabel(scope.row.pred_entity_label) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="分析结果" width="90">
              <template #default="scope">
                <el-tag v-if="scope.row.userType == scope.row.pred_entity_label" type="success" effect="plain">一致</el-tag>
                <el-tag v-else type="danger">不一致</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="交易详情 (哈希)" min-width="150">
              <template #default="scope">
                <div class="hash-cell">
                  <span class="mono-font">{{ formatHash(scope.row.tx_hash) }}</span>
                  <el-button 
                    v-if="scope.row.tx_hash"
                    link type="primary" :icon="DocumentCopy" 
                    @click="copyHash(scope.row.tx_hash)"
                    class="copy-btn"
                  />
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="box-card">
          <template #header><span>AI 预测实体分布</span></template>
          <div ref="pieChartRef" style="height: 280px; width: 100%;"></div>
          
          <div style="text-align: center; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #eee;">
            <p style="font-size: 14px; color: #606266;">
              <span style="font-weight: bold; color: #409EFF;">模型性能指标</span>
            </p>
            <p style="font-size: 13px; color: #909399; margin-top: 5px;">
              测试集准确率 (Accuracy): <span style="color: #67C23A; font-weight: bold;">94.1%</span>
            </p>
          </div>

        </el-card>
        
        <el-card class="box-card" style="margin-top: 20px;">
           <template #header><span>分析结果统计</span></template>
           <el-row :gutter="10" class="stats-mini-cards">
              <el-col :span="12">
                <el-statistic title="居民 (AI)" :value="stats.residential" class="stat-box-mini blue" />
              </el-col>
              <el-col :span="12">
                <el-statistic title="商业 (AI)" :value="stats.commercial" class="stat-box-mini orange" />
              </el-col>
              <el-col :span="12" style="margin-top: 10px">
                <el-statistic title="工业 (AI)" :value="stats.industrial" class="stat-box-mini red" />
              </el-col>
              <el-col :span="12" style="margin-top: 10px">
                 <el-statistic title="不一致" :value="stats.mismatch" class="stat-box-mini grey" />
              </el-col>
           </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { Refresh, Link, DocumentCopy } from '@element-plus/icons-vue';
import * as echarts from 'echarts';

// --- ECharts 实例 ---
let pieChart: echarts.ECharts | null = null;
let lineChart: echarts.ECharts | null = null;
const pieChartRef = ref<HTMLElement | null>(null);
const lineChartRef = ref<HTMLElement | null>(null);

// --- 状态变量 ---
const loading = ref(false);
const tableData = ref<any[]>([]);
let timer: any = null; // 自动刷新定时器

// --- 辅助函数 ---
const entityLabels: Record<string, string> = { '0': '居民', '1': '商业', '2': '工业', 'null': '未指定' };
const entityTags: Record<string, string> = { '0': 'success', '1': 'warning', '2': 'danger', 'null': 'info' };
const getEntityLabel = (label: number) => entityLabels[String(label)];
const getEntityTag = (label: number) => entityTags[String(label)] || 'info';
const formatHash = (hash: string | null) => hash ? `${hash.substring(0, 8)}...${hash.substring(hash.length - 6)}` : 'N/A';
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

// --- 计算统计 ---
const stats = computed(() => {
  return {
    residential: tableData.value.filter(d => d.pred_entity_label === 0).length,
    commercial: tableData.value.filter(d => d.pred_entity_label === 1).length,
    industrial: tableData.value.filter(d => d.pred_entity_label === 2).length,
    mismatch: tableData.value.filter(d => d.userType != d.pred_entity_label).length
  };
});

// --- ECharts 渲染 ---
const renderPieChart = (data: any[]) => {
  try {
    if (!pieChartRef.value) return;
    if (!pieChart) pieChart = echarts.init(pieChartRef.value);
    const pieData = data.map(item => ({
      value: item.count,
      name: getEntityLabel(item.pred_entity_label)
    }));
    pieChart.setOption({
      tooltip: { trigger: 'item' },
      legend: { top: 'bottom', icon: 'circle', itemWidth: 10, itemHeight: 10 },
      series: [{
        name: '实体类型', type: 'pie', radius: ['40%', '70%'],
        avoidLabelOverlap: false, itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 20, fontWeight: 'bold' } },
        data: pieData
      }]
    });
  } catch (e) { console.error("渲染饼图失败:", e); }
};

const renderLineChart = (data: any[]) => {
  try {
    if (!lineChartRef.value) return;
    if (!lineChart) lineChart = echarts.init(lineChartRef.value);
    const categories = data.map(item => item.day);
    const values = data.map(item => parseFloat(item.total_energy).toFixed(2));
    lineChart.setOption({
      tooltip: { trigger: 'axis', valueFormatter: (value: any) => value + ' kWh' },
      xAxis: { type: 'category', boundaryGap: false, data: categories },
      yAxis: { type: 'value', name: 'kWh' },
      grid: { left: '15%', right: '5%', bottom: '15%' },
      series: [{
        name: '交易电量', type: 'line', smooth: true, data: values,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0)' }
          ])
        }
      }]
    });
  } catch (e) { console.error("渲染折线图失败:", e); }
};

// --- API ---
const fetchData = async () => {
  try {
    const token = localStorage.getItem('token');
    const res = await axios.get('/api/admin/entity-dashboard', {
      headers: { 'x-auth-token': token }
    });
    
    if (res.data && Array.isArray(res.data.tableData)) {
      tableData.value = res.data.tableData;
      await nextTick();
      renderPieChart(res.data.pieChartData);
      renderLineChart(res.data.lineChartData);
    } else {
      ElMessage.error("获取数据失败：响应格式不正确");
    }
  } catch (error: any) {
    console.error("FetchData Error:", error.response?.data?.msg || "获取数据失败");
  } finally {
    // loading.value = false;
  }
};

// --- ECharts 响应式 ---
const onResize = () => {
  pieChart?.resize();
  lineChart?.resize();
};

onMounted(() => {
  loading.value = true;
  fetchData().finally(() => {
    loading.value = false;
  });
  window.addEventListener('resize', onResize);
  timer = setInterval(fetchData, 10000); // 10秒
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  window.removeEventListener('resize', onResize);
  pieChart?.dispose();
  lineChart?.dispose();
});
</script>

<style scoped>
.dashboard-container { padding: 20px; }
.box-card { border-radius: 8px; margin-bottom: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; }

/* 迷你统计卡片 */
.stats-mini-cards { text-align: center; }
.stat-box-mini { padding: 10px; border-radius: 4px; background: #f9f9f9; }
.stat-box-mini :deep(.el-statistic__head) { font-size: 14px; }
.stat-box-mini :deep(.el-statistic__content) { font-size: 24px; font-weight: bold; }
.stat-box-mini.blue :deep(.el-statistic__content) { color: #409EFF; }
.stat-box-mini.orange :deep(.el-statistic__content) { color: #E6A23C; }
.stat-box-mini.red :deep(.el-statistic__content) { color: #F56C6C; }
.stat-box-mini.grey :deep(.el-statistic__content) { color: #909399; }

.hash-cell { display: flex; align-items: center; }
.mono-font { font-family: monospace; color: #606266; }
.copy-btn { margin-left: 5px; padding: 0; font-size: 14px; }
</style>