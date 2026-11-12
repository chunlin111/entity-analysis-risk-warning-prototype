<template>
  <div class="page-container dashboard-container">
    <el-card class="action-card">
      <div class="card-header">
        <span>🚨 交易风险预警</span>
        <el-tag type="success" effect="plain" v-if="!loading">
          <el-icon class="is-loading" style="vertical-align: middle; margin-right: 4px"><Refresh /></el-icon>
          自动刷新中
        </el-tag>
      </div>
      <p class="desc">系统自动分析每笔交易。注意：AI模型判定为"无风险"的交易，若用户半年未认证，系统将自动标记为"身份可疑"。</p>
    </el-card>

    <el-row :gutter="20" class="stats-cards">
      <el-col :span="6"><el-statistic title="风险实体 (总计)" :value="stats.riskEntities" class="stat-box grey" /></el-col>
      <el-col :span="6"><el-statistic title="无风险交易" :value="stats.noRisk" class="stat-box green" /></el-col>
      <el-col :span="6"><el-statistic title="频繁/电力异常" :value="stats.freqRisk + stats.powerRisk" class="stat-box blue" /></el-col>
      <el-col :span="6"><el-statistic title="身份可疑" :value="stats.idRisk" class="stat-box red" /></el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="box-card">
          <template #header><span>异常行为趋势 (近7日)</span></template>
          <div ref="lineChartRef" style="height: 300px; width: 100%;"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="box-card">
          <template #header><span>风险类型占比</span></template>
          <div ref="pieChartRef" style="height: 250px; width: 100%;"></div>
          
          <div style="text-align: center; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #eee;">
            <p style="font-size: 14px; color: #606266;">
              <span style="font-weight: bold; color: #409EFF;">模型性能指标</span>
            </p>
            <p style="font-size: 13px; color: #909399; margin-top: 5px;">
              测试集准确率 (Accuracy): <span style="color: #67C23A; font-weight: bold;">96.4%</span>
            </p>
          </div>

        </el-card>
      </el-col>
    </el-row>

    <el-card class="box-card" style="margin-top: 20px">
      <template #header><span>全网交易监控列表 (包含无风险)</span></template>
      <el-table :data="tableData" stripe height="300px" v-loading="loading">
        <el-table-column prop="id" label="分析ID" width="80" />
        <el-table-column label="实体名称" width="120">
           <template #default="scope">
             {{ scope.row.User?.username || `User ${scope.row.user_id}` }}
           </template>
        </el-table-column>
        <el-table-column label="风险等级" width="120">
          <template #default="scope">
            <el-tag :type="getRiskTag(scope.row.pred_risk_label)">
              {{ getRiskLabel(scope.row.pred_risk_label) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="系统判定" min-width="150">
           <template #default="scope">
             {{ getRiskReason(scope.row) }}
           </template>
        </el-table-column>
        
        <el-table-column label="交易详情 (链上哈希)" min-width="180">
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

        <el-table-column label="时间" width="180">
          <template #default="scope">
            {{ new Date(scope.row.Timestamp).toLocaleString() }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, nextTick } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { Refresh, DocumentCopy, Link } from '@element-plus/icons-vue';
import * as echarts from 'echarts';

let pieChart: echarts.ECharts | null = null;
let lineChart: echarts.ECharts | null = null;
const pieChartRef = ref<HTMLElement | null>(null);
const lineChartRef = ref<HTMLElement | null>(null);

const loading = ref(false);
const tableData = ref<any[]>([]); 
const stats = ref({
  riskEntities: 0,
  noRisk: 0,     // Label 0
  freqRisk: 0,   // Label 1
  powerRisk: 0,  // Label 2
  idRisk: 0,     // Label 3
});
let timer: any = null;

const riskLabels: Record<string, string> = { '0': '无风险', '1': '频繁交易', '2': '电力异常', '3': '身份可疑' };
const riskTags: Record<string, string> = { '0': 'success', '1': 'warning', '2': 'warning', '3': 'danger' };
const getRiskLabel = (label: number) => riskLabels[String(label)] || '未知';
const getRiskTag = (label: number) => riskTags[String(label)] || 'info';

const getRiskReason = (row: any) => {
  switch (row.pred_risk_label) {
    case 0: return '各项指标正常';
    case 1: return `日交易次数 (${row.daily_tx_count}) 过高`;
    case 2: return `电压/电流异常 (V: ${row.Voltage_V?.toFixed(1)}, A: ${row.Current_A?.toFixed(1)})`;
    case 3: return '用户身份未认证或长期未活动';
    default: return '未知风险';
  }
};

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

const renderPieChart = (data: any[]) => {
  try {
    if (!pieChartRef.value) return;
    if (!pieChart) pieChart = echarts.init(pieChartRef.value);
    
    const pieData = data.map(item => ({
      value: item.count,
      name: getRiskLabel(item.pred_risk_label)
    }));

    pieChart.setOption({
      tooltip: { trigger: 'item' },
      legend: { top: 'bottom', icon: 'circle' },
      color: ['#67C23A', '#E6A23C', '#409EFF', '#F56C6C'],
      series: [{ name: '风险类型', type: 'pie', radius: '70%', data: pieData }]
    });
  } catch (e) { console.error("渲染饼图失败:", e); }
};

const renderLineChart = (data: any[]) => {
  try {
    if (!lineChartRef.value) return;
    if (!lineChart) lineChart = echarts.init(lineChartRef.value);
    const categories = data.map(item => item.day);
    const values = data.map(item => item.risk_count);
    lineChart.setOption({
      tooltip: { trigger: 'axis', valueFormatter: (value: any) => value + ' 笔' },
      xAxis: { type: 'category', boundaryGap: false, data: categories },
      yAxis: { type: 'value', name: '交易数量' },
      grid: { left: '10%', right: '5%', bottom: '10%', top: '10%' },
      series: [{
        name: '总交易量', type: 'line', smooth: true, data: values,
        itemStyle: { color: '#409EFF' },
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

const fetchData = async () => {
  try {
    const token = localStorage.getItem('token');
    const res = await axios.get('/api/admin/risk-dashboard', {
      headers: { 'x-auth-token': token }
    });
    
    if (res.data) {
      tableData.value = res.data.tableData;

      let noRisk = 0;
      let freqRisk = 0;
      let powerRisk = 0;
      let idRisk = 0;

      res.data.pieChartData.forEach((item: any) => {
        if (item.pred_risk_label === 0) noRisk = item.count;
        if (item.pred_risk_label === 1) freqRisk = item.count;
        if (item.pred_risk_label === 2) powerRisk = item.count;
        if (item.pred_risk_label === 3) idRisk = item.count;
      });
      
      stats.value = {
        riskEntities: res.data.riskEntityCount,
        noRisk: noRisk,
        freqRisk: freqRisk,
        powerRisk: powerRisk,
        idRisk: idRisk
      };

      await nextTick();
      renderPieChart(res.data.pieChartData);
      renderLineChart(res.data.lineChartData);
    }
  } catch (error: any) {
    console.error("FetchData Error:", error.response?.data?.msg || "获取数据失败");
  }
};

const onResize = () => {
  pieChart?.resize();
  lineChart?.resize();
};

onMounted(() => {
  loading.value = true;
  fetchData().finally(() => { loading.value = false; });
  window.addEventListener('resize', onResize);
  timer = setInterval(fetchData, 10000); 
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
.action-card { margin-bottom: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
.desc { font-size: 13px; color: #909399; margin-top: 10px; }
.stats-cards { margin-bottom: 20px; }
.stat-box { background: #fff; padding: 20px; border-radius: 4px; box-shadow: var(--el-box-shadow-light); }
.stat-box :deep(.el-statistic__content) { font-size: 28px; font-weight: bold; }
.stat-box.green :deep(.el-statistic__head) { color: #67C23A; }
.stat-box.orange :deep(.el-statistic__head) { color: #E6A23C; }
.stat-box.blue :deep(.el-statistic__head) { color: #409EFF; }
.stat-box.red :deep(.el-statistic__head) { color: #F56C6C; }
.stat-box.grey :deep(.el-statistic__head) { color: #909399; }
.box-card { border-radius: 8px; margin-bottom: 20px; }
.hash-cell { display: flex; align-items: center; }
.mono-font { font-family: monospace; color: #606266; }
.copy-btn { margin-left: 5px; padding: 0; font-size: 14px; }
</style>