<template>
  <el-container class="layout-container">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <el-icon size="24" style="margin-right: 8px"><Management /></el-icon>
        <span>{{ userRole === 4 ? '审计中心' : '管理端' }}</span>
      </div>
      
      <el-menu
        :default-active="activeMenu"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#F56C6C"
        router
        class="el-menu-vertical"
      >
        <template v-if="userRole === 0">
          <el-menu-item index="/admin/monitor">
            <el-icon><DataLine /></el-icon><span>区块检测</span>
          </el-menu-item>
          
          <el-menu-item index="/admin/audit">
            <el-icon><Stamp /></el-icon><span>业务审核</span>
          </el-menu-item>
  
          <el-menu-item index="/admin/analysis">
            <el-icon><PieChart /></el-icon><span>实体分析</span>
          </el-menu-item>
          
          <el-menu-item index="/admin/risk">
            <el-icon><WarnTriangleFilled /></el-icon><span>风险预警</span>
          </el-menu-item>
          
          <el-menu-item index="/admin/verify">
            <el-icon><Search /></el-icon><span>交易存证查验</span>
          </el-menu-item>
        </template>

        <template v-if="userRole === 4">
          <el-menu-item index="/admin/auditLogs">
            <el-icon><Document /></el-icon><span>日志管理</span>
          </el-menu-item>
        </template>

      </el-menu>
    </el-aside>
 
    <el-container>
      <el-header class="header">
        <div class="breadcrumb">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>后台系统</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="user-info">
          <el-dropdown>
            <span class="el-dropdown-link">
              <el-avatar 
                :size="32" 
                :style="{ marginRight: '8px', background: userRole === 4 ? '#E6A23C' : '#F56C6C' }"
              >
                {{ userRole === 4 ? '审' : '管' }}
              </el-avatar>
              <span class="username">{{ displayAddress }}</span>
              <el-icon class="el-icon--right"><arrow-down /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>
                  角色: {{ userRole === 4 ? '审计专员' : '超级管理员' }}
                </el-dropdown-item>
                <el-dropdown-item divided @click="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
 
      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>
 
<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
// 引入图标 (增加了 Document 图标用于日志)
import { DataLine, Stamp, PieChart, WarnTriangleFilled, Search, Management, ArrowDown, Document } from '@element-plus/icons-vue';
 
const route = useRoute();
const router = useRouter();

// 1. 定义角色状态
const userRole = ref<number>(-1);

const activeMenu = computed(() => route.path);
const currentTitle = computed(() => route.meta.title as string || '首页');
const username = localStorage.getItem('username') || '';
const displayAddress = computed(() => username.length > 10 ? `${username.substring(0, 6)}...${username.substring(username.length - 4)}` : username || '未登录');

// 2. 页面加载时获取角色
onMounted(() => {
  const roleStr = localStorage.getItem('role');
  userRole.value = roleStr ? parseInt(roleStr) : -1;
});

const logout = () => { 
  localStorage.clear(); 
  router.push('/login'); 
};
</script>
 
<style scoped>
/* 保持您原有的样式不变 */
.layout-container { height: 100vh; }
.aside { background-color: #304156; color: white; display: flex; flex-direction: column; }
.logo { height: 60px; display: flex; align-items: center; justify-content: center; background-color: #2b3a4d; font-size: 18px; font-weight: bold; color: white; }
.el-menu-vertical { border-right: none; }
.header { background-color: white; border-bottom: 1px solid #e6e6e6; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; height: 60px; }
.user-info .el-dropdown-link { cursor: pointer; display: flex; align-items: center; color: #606266; }
.username { font-weight: 500; margin-right: 4px; }
.main-content { background-color: #f0f2f5; padding: 20px; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>