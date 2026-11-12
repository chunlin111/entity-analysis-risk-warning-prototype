<template>
  <div class="login-wrapper">
    <div class="bg-overlay"></div>
    
    <div class="login-box">
      <div class="header">
        <h1 style="font-size: 22px; line-height: 1.4; margin-bottom: 15px;">
          多维跨链的能源电力区块链<br>生态实体关系分析与风险预警原型系统
        </h1>
      </div>

      <transition name="slide-fade" mode="out-in">
        <div v-if="selectedRole === null" class="role-selection" key="step1">
          <h3>请选择您的登录身份</h3>
          <div class="roles-grid">
            <div class="role-card" @click="selectRole(1)">
              <div class="icon-bg seller-bg"><el-icon><Upload /></el-icon></div>
              <span class="role-name">电力上架</span>
              <span class="role-desc">发电企业 / 售电方</span>
            </div>
            
            <div class="role-card" @click="selectRole(2)">
              <div class="icon-bg buyer-bg"><el-icon><ShoppingCart /></el-icon></div>
              <span class="role-name">电力需求</span>
              <span class="role-desc">工厂 / 购电大户</span>
            </div>
            
            <div class="role-card" @click="selectRole(0)">
              <div class="icon-bg admin-bg"><el-icon><Management /></el-icon></div>
              <span class="role-name">后端管理</span>
              <span class="role-desc">平台运营 / 监管</span>
            </div>
          </div>
          <div class="quick-links">
            <router-link to="/register">还没有账号？立即注册</router-link>
          </div>
        </div>

        <div v-else class="login-form" key="step2">
          <div class="form-header">
            <el-button link @click="selectedRole = null" icon="Back">返回选择</el-button>
            <span class="current-role">登录身份：{{ roleName }}</span>
          </div>
          
          <el-form :model="form" size="large" @keyup.enter="handleLogin">
            <el-form-item>
              <el-input v-model="form.email" placeholder="请输入邮箱" prefix-icon="User" />
            </el-form-item>
            
            <el-form-item>
              <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password prefix-icon="Lock" />
            </el-form-item>

            <el-form-item>
              <div class="captcha-row">
                <el-input 
                  v-model="form.captcha" 
                  placeholder="请输入验证码" 
                  prefix-icon="CircleCheck"
                  maxlength="4"
                  style="flex: 1" 
                />
                <div 
                  class="captcha-box" 
                  @click="refreshCaptcha" 
                  title="看不清？点击刷新"
                  v-html="captchaSvg"
                ></div>
              </div>
            </el-form-item>
            
            <div class="terms-checkbox">
              <el-checkbox v-model="agreed">
                我已阅读并同意 <span class="link-text" @click.prevent="showTerms = true">《服务条款与隐私策略》</span>
              </el-checkbox>
            </div>

            <el-button type="primary" class="login-btn" :loading="loading" @click="handleLogin">
              登 录
            </el-button>

            <div class="form-footer">
              <router-link to="/forgot-password">忘记密码?</router-link>
              <router-link to="/register">注册新账号</router-link>
            </div>
          </el-form>
        </div>
      </transition>
    </div>

    <TermsModal v-model="showTerms" @agree="agreed = true" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock, Back, Upload, ShoppingCart, Management, CircleCheck } from '@element-plus/icons-vue';
import { doSm2Encrypt, doSm3Hash } from '../utils/smCrypto';
import TermsModal from '../components/TermsModal.vue';

const router = useRouter();
const loading = ref(false);
const selectedRole = ref<number | null>(null);

const form = ref({ email: '', password: '', captcha: '' });
const captchaSvg = ref('');

const showTerms = ref(false);
const agreed = ref(false);

const roleName = computed(() => {
  if (selectedRole.value === 1) return '电力上架 (Seller)';
  if (selectedRole.value === 2) return '电力需求 (Buyer)';
  // 这里的显示文案可以稍微改一下，或者保持原样
  if (selectedRole.value === 0) return '后端管理 (Admin)'; 
  return '';
});

const refreshCaptcha = async () => {
  try {
    const res = await axios.get(`/api/auth/captcha?t=${Date.now()}`);
    captchaSvg.value = res.data;
    form.value.captcha = '';
  } catch (err) {
    console.error('验证码加载失败');
  }
};

const selectRole = (role: number) => {
  selectedRole.value = role;
  refreshCaptcha();
};

// ==========================================
// 🚀 核心修改区域：handleLogin
// ==========================================
const handleLogin = async () => {
  if (!form.value.email || !form.value.password) return ElMessage.warning('请填写完整账号密码');
  if (!form.value.captcha || form.value.captcha.length !== 4) return ElMessage.warning('请输入4位验证码');
  if (!agreed.value) return ElMessage.warning('请先勾选同意服务条款');
  
  loading.value = true;
  try {
    const encryptedPassword = doSm2Encrypt(form.value.password);
    const sign = doSm3Hash(form.value.password);

    const res = await axios.post('/api/auth/login', {
      email: form.value.email,
      password: encryptedPassword, // 发送密文
      sign: sign,                  // 发送 SM3 签名用于后端校验
      captcha: form.value.captcha  // 验证码
    });
    const { token, role, username } = res.data;

    // ✅ 修改点 1：放宽角色校验
    // 逻辑：如果选的是管理员入口(0)，允许 0 和 4 通过；其他入口必须严格匹配
    let isRoleValid = false;
    if (selectedRole.value === 0) {
        if (role === 0 || role === 4) isRoleValid = true;
    } else {
        if (role === selectedRole.value) isRoleValid = true;
    }

    if (!isRoleValid) {
      ElMessage.error(`登录失败：您的账号角色是 [${getRoleLabel(role)}]，请返回重新选择对应入口。`);
      loading.value = false;
      refreshCaptcha();
      return;
    }

    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    localStorage.setItem('username', username);
    
    ElMessage.success('登录成功，欢迎回来');

    // ✅ 修改点 2：跳转逻辑
    // 审计员(4) 和 管理员(0) 都去 /admin，具体的页面分流由路由守卫负责
    if (role === 0 || role === 4) {
        router.push('/admin');
    } 
    else if (role === 1) {
        router.push('/seller');
    } 
    else {
        router.push('/buyer');
    }

  } catch (error: any) {
    const resData = error.response?.data;
    
    if (resData?.code === 'PASSWORD_EXPIRED') {
      ElMessage.error(resData.msg);
      return;
    }

    ElMessage.error(resData?.msg || "登录失败");
    refreshCaptcha();
  } finally {
    loading.value = false;
  }
};

// ✅ 修改点 3：增加审计员的标签说明 (用于报错提示)
const getRoleLabel = (r: number) => {
  if (r === 4) return '审计员'; // 新增
  return r === 0 ? '管理员' : (r === 1 ? '商家' : '买家');
};
</script>

<style scoped>
/* 背景设置 */
.login-wrapper {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: url('https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80') no-repeat center center;
  background-size: cover;
  position: relative;
}

/* 遮罩层 */
.bg-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(16, 24, 39, 0.85); 
  backdrop-filter: blur(4px);
}

.login-box {
  position: relative;
  z-index: 10;
  width: 520px;
  background: rgba(255, 255, 255, 0.98);
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  text-align: center;
}

.header h1 { margin: 0 0 10px 0; color: #2c3e50; letter-spacing: 1px; font-size: 26px; }
.header p { margin: 0 0 30px 0; color: #7f8c8d; font-size: 14px; }

/* 角色卡片 */
.roles-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.role-card {
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 20px 8px;
  cursor: pointer;
  transition: all 0.3s;
  background: #fff;
}
.role-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.1);
  border-color: #409EFF;
  background: #fbfdff;
}

.icon-bg {
  width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 12px;
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 26px;
}
.seller-bg { background: linear-gradient(135deg, #667eea, #764ba2); }
.buyer-bg { background: linear-gradient(135deg, #4facfe, #00f2fe); }
.admin-bg { background: linear-gradient(135deg, #ff9a9e, #fecfef); }

.role-name { display: block; font-weight: bold; color: #333; margin-bottom: 4px; font-size: 15px; }
.role-desc { display: block; font-size: 12px; color: #999; }

.quick-links { margin-top: 20px; font-size: 14px; }
.quick-links a { color: #409EFF; text-decoration: none; font-weight: 500; }

/* 表单部分 */
.form-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 25px; padding-bottom: 10px; border-bottom: 1px solid #eee;
}
.current-role { font-weight: bold; color: #303133; font-size: 15px; }

/* ✅ 验证码样式 */
.captcha-row {
  display: flex;
  gap: 10px;
  width: 100%;
  align-items: center;
}
.captcha-box {
  width: 110px;
  height: 40px; /* 与 Element Plus large 输入框高度一致 */
  background-color: #f2f6fc;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.captcha-box :deep(svg) {
  width: 100%;
  height: 100%;
}

.terms-checkbox { margin-bottom: 15px; text-align: left; font-size: 14px; }
.link-text { color: #409EFF; cursor: pointer; font-weight: bold; }

.login-btn { width: 100%; font-weight: bold; font-size: 16px; height: 44px; margin-top: 5px; }

.form-footer {
  margin-top: 15px; display: flex; justify-content: space-between; font-size: 14px;
}
.form-footer a { color: #606266; text-decoration: none; transition: color 0.2s; }
.form-footer a:hover { color: #409EFF; }

/* Vue 动画 */
.slide-fade-enter-active, .slide-fade-leave-active { transition: all 0.3s ease; }
.slide-fade-enter-from { opacity: 0; transform: translateX(20px); }
.slide-fade-leave-to { opacity: 0; transform: translateX(-20px); }
</style>