<template>
  <div class="forgot-container">
    <div class="bg-overlay"></div>
    
    <el-card class="box-card">
      <div class="header">
        <h2>🔒 重置密码</h2>
        <p class="subtitle">通过邮箱验证码修改您的密码</p>
      </div>
  
      <el-form 
        ref="formRef"
        :model="form" 
        :rules="rules"
        label-position="top" 
        size="large"
      >
        
        <el-form-item label="注册邮箱" prop="email">
          <el-input 
            v-model="form.email" 
            placeholder="请输入您的注册邮箱" 
            prefix-icon="Message" 
          />
        </el-form-item>

        <el-form-item label="邮箱验证码" prop="code">
          <div class="code-row">
            <el-input 
              v-model="form.code" 
              placeholder="6位验证码" 
              prefix-icon="Key"
              style="flex: 1" 
              maxlength="6"
            />
            <el-button 
              type="primary" 
              plain 
              @click="sendCode" 
              :disabled="isSending || timer > 0"
              style="width: 130px"
            >
              {{ timer > 0 ? `${timer}s 后重发` : (isSending ? '发送中...' : '获取验证码') }}
            </el-button>
          </div>
        </el-form-item>
  
        <el-form-item label="设置新密码" prop="newPassword">
          <el-input 
            v-model="form.newPassword" 
            type="password" 
            show-password 
            placeholder="8-20位，含大小写/数字/符号中的3种" 
            prefix-icon="Lock"
          />
        </el-form-item>
  
        <el-button 
          type="primary" 
          class="submit-btn" 
          @click="handleReset" 
          :loading="loading"
        >
          确认重置密码
        </el-button>
  
        <div class="footer">
          <router-link to="/login">想起密码了？去登录</router-link>
        </div>
      </el-form>
    </el-card>
  </div>
</template>
  
<script setup lang="ts">
import { ref, reactive } from 'vue';
import axios from 'axios';
import { ElMessage, type FormInstance } from 'element-plus';
import { useRouter } from 'vue-router';
import { Message, Key, Lock } from '@element-plus/icons-vue';
import { doSm2Encrypt, doSm3Hash } from '../utils/smCrypto';
  
const router = useRouter();
const formRef = ref<FormInstance>(); // 表单引用

const form = reactive({ 
  email: '', 
  code: '', 
  newPassword: '' 
});

const timer = ref(0);
const loading = ref(false);
const isSending = ref(false);

// === 1. 定义强密码校验规则 (前端校验) ===
const validatePasswordComplexity = (rule: any, value: any, callback: any) => {
  if (!value) return callback(new Error('请输入新密码'));
  
  // 长度校验
  if (value.length < 8 || value.length > 20) {
    return callback(new Error('密码长度必须在 8 到 20 位之间'));
  }

  // 复杂度校验 (四选三)
  let count = 0;
  if (/[A-Z]/.test(value)) count++; // 大写
  if (/[a-z]/.test(value)) count++; // 小写
  if (/[0-9]/.test(value)) count++; // 数字
  if (/[^A-Za-z0-9]/.test(value)) count++; // 特殊符号

  if (count < 3) {
    return callback(new Error('密码需包含大写、小写、数字、符号中的至少3种'));
  }
  
  callback();
};

// === 2. 表单规则定义 ===
const rules = {
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: ['blur', 'change'] }
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为6位数字', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, validator: validatePasswordComplexity, trigger: 'blur' }
  ]
};

// === 3. 发送验证码逻辑 ===
const sendCode = async () => {
  // 单独校验邮箱字段
  if (!form.email) return ElMessage.warning('请先输入邮箱');
  
  // 简单正则预检
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(form.email)) return ElMessage.warning("邮箱格式不正确");

  isSending.value = true;
  try {
    // 调用后端接口
    await axios.post('/api/auth/reset-password-code', { email: form.email });
    ElMessage.success('验证码已发送至您的邮箱');
    
    // 启动 60秒 倒计时
    timer.value = 60;
    const interval = setInterval(() => {
      timer.value--;
      if (timer.value <= 0) clearInterval(interval);
    }, 1000);
  } catch (error: any) {
    ElMessage.error(error.response?.data?.msg || '发送失败，请检查邮箱是否已注册');
  } finally {
    isSending.value = false;
  }
};
  
// === 4. 提交重置逻辑 ===
const handleReset = async () => {
  if (!formRef.value) return;

  // 全局校验表单
  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;
      try {
        const encryptedPassword = doSm2Encrypt(form.newPassword); // 加密
        const sign = doSm3Hash(form.newPassword);                 // 签名
        await axios.post('/api/auth/reset-password', {
          email: form.email,
          code: form.code,
          newPassword: encryptedPassword, // 发送密文
          sign: sign                      // 发送签名
      });
        ElMessage.success('🎉 密码重置成功！请使用新密码登录');
        router.push('/login');
      } catch (error: any) {
        // 这里会捕获后端返回的错误 (如：验证码错误、新旧密码相同等)
        ElMessage.error(error.response?.data?.msg || '重置失败');
      } finally {
        loading.value = false;
      }
    }
  });
};
</script>
  
<style scoped>
.forgot-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  /* 使用与登录注册页一致的背景图 */
  background: url('https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80') no-repeat center center;
  background-size: cover;
  position: relative;
}

.bg-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(16, 24, 39, 0.75); /*稍微深一点的遮罩，增加文字对比度*/
  backdrop-filter: blur(4px);
}

.box-card { 
  width: 480px; 
  position: relative;
  z-index: 10;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.4);
  padding: 10px;
}

.header { text-align: center; margin-bottom: 25px; }
.header h2 { margin: 0 0 8px 0; color: #303133; font-size: 24px; }
.subtitle { font-size: 14px; color: #909399; margin: 0; }

.code-row { display: flex; gap: 12px; width: 100%; }

.submit-btn { 
  width: 100%; 
  margin-top: 25px; 
  height: 44px; 
  font-size: 16px; 
  font-weight: bold;
  letter-spacing: 1px; 
}

.footer { text-align: center; margin-top: 20px; font-size: 14px; }
.footer a { 
  color: #606266; 
  text-decoration: none; 
  transition: color 0.3s;
}
.footer a:hover { 
  color: #409EFF; 
  text-decoration: underline; 
}
</style>