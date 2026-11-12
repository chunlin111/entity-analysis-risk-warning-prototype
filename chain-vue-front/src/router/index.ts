import { createRouter, createWebHistory } from 'vue-router';
import Login from '../views/Login.vue';
import Register from '../views/Register.vue';
import AdminDashboard from '../views/AdminDashboard.vue';
import SellerDashboard from '../views/SellerDashboard.vue';
import BuyerDashboard from '../views/BuyerDashboard.vue';
import ForgotPassword from '../views/ForgotPassword.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', name: 'Login', component: Login },
    { path: '/register', name: 'Register', component: Register },
    { path: '/forgot-password', component: ForgotPassword },
    
    // Admin (Role 0)
    { 
      path: '/admin', 
      name: 'Admin', 
      component: AdminDashboard,
      // ✅ 允许 0 (管理员) 和 4 (审计员) 进入主入口
      meta: { requiresAuth: true, roles: [0, 4] }, 
      
      // 动态重定向：审计员去日志，管理员去监控
      redirect: (to) => {
        const roleStr = localStorage.getItem('role');
        const role = roleStr ? parseInt(roleStr) : -1;
        if (role === 4) return '/admin/auditLogs';
        return '/admin/monitor';
      },

      // ✅ 注意：children 数组开始
      children: [
        // --- 仅管理员 (Role 0) ---
        { path: 'monitor', component: () => import('../views/admin/BlockMonitor.vue'), meta: { title: '区块检测', roles: [0] } },
        { path: 'audit', component: () => import('../views/admin/Audit.vue'), meta: { title: '业务审核', roles: [0] } },
        { path: 'analysis', component: () => import('../views/admin/EntityAnalysis.vue'), meta: { title: '实体分析', roles: [0] } },
        { path: 'risk', component: () => import('../views/admin/RiskWarning.vue'), meta: { title: '风险预警', roles: [0] } },
        { path: 'verify', component: () => import('../views/admin/Verify.vue'), meta: { title: '交易存证查验', roles: [0] } },
        
        // --- 仅审计员 (Role 4) ---
        // ✅ 关键点：auditLogs 必须在 children 数组内部，且前面不要加斜杠
        { 
          path: 'auditLogs', 
          component: () => import('../views/admin/AuditLogs.vue'), 
          meta: { title: '日志管理', roles: [4] } 
        } 
      ] 
      // ✅ children 数组结束 (您之前可能在这里少了这个括号，或者在这个括号之前就把 auditLogs 结束了)
    },
    // Seller (Role 1)
    { 
      path: '/seller', 
      name: 'Seller', 
      component: SellerDashboard,
      meta: { requiresAuth: true, role: 1 }, // 需要权限，角色 1
      redirect: '/seller/market', 
      children: [ 
        { path: 'market', component: () => import('../views/seller/Market.vue'), meta: { title: '交易广场' } },
        { path: 'publish', component: () => import('../views/seller/Publish.vue'), meta: { title: '上架电力资源' } },
        { path: 'orders', component: () => import('../views/seller/Orders.vue'), meta: { title: '参与合约进展' } },
        { path: 'verify', component: () => import('../views/seller/Verify.vue'), meta: { title: '交易存证查验' } }
      ]
    },
    // Buyer (Role 2)
    { 
      path: '/buyer', 
      name: 'Buyer', 
      component: BuyerDashboard, 
      meta: { requiresAuth: true, role: 2 }, // 需要权限，角色 2
      redirect: '/buyer/market',
      children: [
        { path: 'market', component: () => import('../views/buyer/Market.vue'), meta: { title: '交易广场' } },
        { path: 'orders', component: () => import('../views/buyer/Orders.vue'), meta: { title: '参与合约进展' } },
        { path: 'verify', component: () => import('../views/buyer/Verify.vue'), meta: { title: '交易存证查验' } }
      ]
    }
  ]
});

// === 
// === 全局路由 (更严格的检查) ===
// === 
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');

  // 1. 目标页面是否需要登录
  if (to.meta.requiresAuth) {
    
    // 1a. 没有 Token -> 踢回登录页
    if (!token) {
      return next('/login');
    }

    // 1b. 有 Token，但角色不匹配
    // (使用 parseInt 确保是数字比较)
    const roleAsNumber = userRole ? parseInt(userRole, 10) : -1;
    
    if (to.meta.role !== undefined && roleAsNumber !== to.meta.role) {
      // 角色不匹配！
      // (例如，一个买家(2) 试图访问 /admin (meta.role: 0))
      console.error(`权限拦截：用户 (Role ${roleAsNumber}) 试图访问 (Role ${to.meta.role}) 页面`);
      
      // 踢回该用户 *自己* 的首页
      if (roleAsNumber === 1) return next('/seller');
      if (roleAsNumber === 2) return next('/buyer');
      return next('/login'); // 默认踢回登录
    }

    // 1c. Token 有，角色也匹配 -> 放行
    next();

  } else {
    // 2. 目标页面不需要登录 (如 /login, /register) -> 直接放行
    next();
  }
});

export default router;