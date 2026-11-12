import { createApp } from 'vue'
import App from './App.vue'
import router from './router' 
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import axios from 'axios'
// ✅ 合并导入：同时引入 ElMessage (轻提示) 和 ElMessageBox (弹窗)
import { ElMessage, ElMessageBox } from 'element-plus';

const app = createApp(App)


// ============================================================
// 🚀 新增：请求拦截器 (Request Interceptor)
// 作用：每次发请求前，自动从 localStorage 取出 Token 并塞入 Header
// ============================================================
axios.interceptors.request.use(
  (config) => {
    // 1. 获取 Token
    const token = localStorage.getItem('token');
    
    // 2. 如果有 Token，就加到请求头里
    if (token) {
      // 注意：这里要跟后端 middleware/auth.js 里获取的字段名一致
      // 您后端代码写的是 req.header('x-auth-token')，所以这里用 'x-auth-token'
      config.headers['x-auth-token'] = token;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
// ============================================================
// 🛡️ 核心修复：Axios 响应拦截器 (集成互踢与超时机制)
// ============================================================
axios.interceptors.response.use(
  (response) => {
    // 2xx 成功，直接返回
    return response;
  }, 
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const msg = data.msg || '未知错误';
      const code = data.code; // 获取后端返回的错误代码 (如 DUPLICATE_LOGIN)

      // --------------------------------------------------
      // Case 1: 401 认证失败 (未登录、Token过期、异地登录、会话超时)
      // --------------------------------------------------
      if (status === 401) {
        
        // 场景 A: 异地登录 (互踢) -> 使用弹窗强提醒
        if (code === 'DUPLICATE_LOGIN') {
          ElMessageBox.alert(
            '您的账号已在其他设备登录，当前会话已失效。如非本人操作，请立即修改密码。', 
            '下线通知', 
            {
              confirmButtonText: '重新登录',
              type: 'warning',
              showClose: false, // 禁止关闭，强制用户点击按钮
              callback: () => {
                localStorage.clear();
                router.push('/login');
              }
            }
          );
          return Promise.reject(error); // 中断后续逻辑
        }

        // 场景 B: 会话超时 (30分钟未操作)
        if (code === 'SESSION_EXPIRED') {
          ElMessage.warning('30分钟未操作，会话已自动结束，请重新登录');
        } 
        // 场景 C: 普通 Token 无效/过期
        else {
          ElMessage.error(msg || '登录状态已失效，请重新登录');
        }

        // 统一执行清理和跳转
        localStorage.clear();
        router.push('/login');
      } 
      
      // --------------------------------------------------
      // Case 2: 403 权限拒绝 (账户锁定、密码过期、角色权限不足)
      // --------------------------------------------------
      else if (status === 403) {
        
        // 场景 D: 密码过期 (强制跳转去修改密码)
        if (code === 'PASSWORD_EXPIRED') {
          ElMessage.error(msg);
          setTimeout(() => {
            localStorage.clear();
            router.push('/forgot-password'); // 跳转到重置密码页
          }, 1500);
        }
        // 场景 E: 账户锁定 / 权限不足
        else {
          // ElMessage.error(msg); // 直接显示后端返回的具体原因
        }
      } 
      
      // --------------------------------------------------
      // Case 3: 其他错误 (500, 404 等)
      // --------------------------------------------------
      else {
        // ElMessage.error('服务器错误: ' + msg);
      }
    } else {
      // 网络断开等没有 response 的情况
      ElMessage.error('网络连接异常，请检查网络');
    }
    return Promise.reject(error);
  }
);
// ============================================================

app.use(router)
app.use(ElementPlus)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')