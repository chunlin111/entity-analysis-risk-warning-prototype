<template>
    <el-container class="layout-container">
      <el-aside width="220px" class="aside">
        <div class="logo">
          <el-icon size="24" style="margin-right: 8px"><ShoppingCart /></el-icon>
          <span>买家端</span>
        </div>
        <el-menu
          :default-active="activeMenu"
          background-color="#2d3a4b"
          text-color="#bfcbd9"
          active-text-color="#67C23A"
          router
          class="el-menu-vertical"
        >
          <el-menu-item index="/buyer/market">
            <el-icon><Shop /></el-icon><span>交易广场</span>
          </el-menu-item>
          <el-menu-item index="/buyer/orders">
            <el-icon><List /></el-icon><span>参与合约进展</span>
          </el-menu-item>
          <el-menu-item index="/buyer/verify">
            <el-icon><Search /></el-icon><span>交易存证查验</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
  
      <el-container>
        <el-header class="header">
          <div class="breadcrumb">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item>买家中心</el-breadcrumb-item>
              <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <div class="user-info">
            <el-dropdown>
              <span class="el-dropdown-link">
                <el-avatar :size="32" style="margin-right: 8px; background: #67C23A">买</el-avatar>
                <span class="username">{{ displayAddress }}</span>
                <el-icon class="el-icon--right"><arrow-down /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item disabled>角色: 电力购买商</el-dropdown-item>
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
  import { computed } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { Shop, List, Search, ShoppingCart, ArrowDown } from '@element-plus/icons-vue';
  
  const route = useRoute();
  const router = useRouter();
  const activeMenu = computed(() => route.path);
  const currentTitle = computed(() => route.meta.title as string || '首页');
  const username = localStorage.getItem('username') || '';
  const displayAddress = computed(() => username.length > 10 ? `${username.substring(0, 6)}...${username.substring(username.length - 4)}` : username || '未登录');
  const logout = () => { localStorage.clear(); router.push('/login'); };
  </script>
  
  <style scoped>
  /* 复用之前的样式，为了简洁这里省略，请把 SellerDashboard.vue 里的 <style> 完整复制过来 */
  .layout-container { height: 100vh; }
  .aside { background-color: #2d3a4b; color: white; display: flex; flex-direction: column; }
  .logo { height: 60px; display: flex; align-items: center; justify-content: center; background-color: #263445; font-size: 18px; font-weight: bold; color: white; }
  .el-menu-vertical { border-right: none; }
  .header { background-color: white; border-bottom: 1px solid #e6e6e6; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; height: 60px; }
  .user-info .el-dropdown-link { cursor: pointer; display: flex; align-items: center; color: #606266; }
  .username { font-weight: 500; margin-right: 4px; }
  .main-content { background-color: #f0f2f5; padding: 20px; }
  .fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
  .fade-enter-from, .fade-leave-to { opacity: 0; }
  </style>