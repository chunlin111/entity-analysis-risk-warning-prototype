<template>
  <div class="auth-container">
    <div class="bg-overlay"></div>

    <el-card class="card">
      <div class="header">
        <h2>创建新账户</h2>
        <p>加入去中心化电力交易网络 (测试模式)</p>
      </div>
      
      <el-form 
        :model="form" 
        ref="formRef" 
        :rules="rules" 
        label-position="top" 
        size="large"
      >
        
        <el-form-item label="您的身份 (用户类型)" prop="role">
          <el-select v-model="form.role" placeholder="请选择您的身份" style="width: 100%">
            <el-option label="电力需求方 (Buyer)" :value="2" />
            <el-option label="电力上架方 (Seller)" :value="1" />
            <el-option label="管理员 (Admin)" :value="0" />
          </el-select>
        </el-form-item>

        <transition name="el-fade-in-linear">
          <el-form-item 
            v-if="form.role === 0" 
            label="管理员邀请码 (内部验证)" 
            prop="adminCode"
          >
            <el-input 
              v-model="form.adminCode" 
              placeholder="请输入管理员邀请码" 
              prefix-icon="Key"
              type="password"
              show-password
            />
          </el-form-item>
        </transition>

        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入您的昵称或企业名" prefix-icon="User" />
        </el-form-item>

        <transition name="el-fade-in-linear">
          <el-form-item v-if="form.role === 2" label="您的实体类型 (必选)" prop="userType">
            <el-select v-model="form.userType" placeholder="请选择您的实体类型" style="width: 100%">
              <el-option label="居民 (Residential)" :value="0" />
              <el-option label="商业 (Commercial)" :value="1" />
              <el-option label="工业 (Industrial)" :value="2" />
            </el-select>
            <div class="form-tip">AI 系统将根据此类型分析您的用电行为</div>
          </el-form-item>
        </transition>

        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="name@example.com" prefix-icon="Message" />
        </el-form-item>

        <el-form-item label="安全验证" prop="imgCaptcha">
          <div class="captcha-row">
            <el-input 
              v-model="form.imgCaptcha" 
              placeholder="请输入右侧字符" 
              prefix-icon="CircleCheck"
              style="flex: 1"
              maxlength="4"
            />
            <div 
              class="captcha-img-box" 
              @click="refreshCaptcha" 
              title="点击刷新验证码"
              v-html="captchaSvg"
            ></div>
          </div>
        </el-form-item>

        <el-form-item label="邮箱验证码" prop="code">
          <div class="code-row">
            <el-input 
              v-model="form.code" 
              placeholder="6位邮件验证码" 
              prefix-icon="Key" 
              style="flex: 1" 
              maxlength="6"
            />
            <el-button 
              type="primary" 
              plain 
              @click="sendEmailCode" 
              :disabled="isSending || timer > 0"
              style="width: 130px"
            >
              {{ timer > 0 ? `${timer}s 后重发` : '获取验证码' }}
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="设置密码" prop="password">
          <el-input 
            v-model="form.password" 
            type="password" 
            show-password 
            placeholder="8-20位，含大小写/数字/符号中3种" 
            prefix-icon="Lock" 
          />
        </el-form-item>

        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" show-password placeholder="请再次输入密码" prefix-icon="Lock" />
        </el-form-item>

        <el-form-item>
          <el-checkbox v-model="agreed">
            我已阅读并同意 
            <span class="link-text" @click.prevent="showTerms = true">《服务条款与隐私策略》</span>
          </el-checkbox>
        </el-form-item>

        <el-button type="primary" @click="handleRegister" style="width: 100%" :loading="loading" class="reg-btn">
          立即注册
        </el-button>

        <div class="footer-link">
          <router-link to="/login">已有账号？去登录</router-link>
        </div>
      </el-form>
    </el-card>

    <TermsModal v-model="showTerms" @agree="agreed = true" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage, type FormInstance } from 'element-plus';
import { useRouter } from 'vue-router';
import { User, Message, Lock, Key, CircleCheck } from '@element-plus/icons-vue';
import TermsModal from '../components/TermsModal.vue';
import { doSm2Encrypt, doSm3Hash } from '../utils/smCrypto';

const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const showTerms = ref(false);
const agreed = ref(false);

// 验证码相关状态
const captchaSvg = ref(''); 
const timer = ref(0);
const isSending = ref(false);

const form = reactive({
  role: 2,
  username: '',
  userType: null as number | null,
  email: '',
  imgCaptcha: '',
  code: '',       
  password: '',
  confirmPassword: '',
  adminCode: '' // ✅ 初始化 adminCode
});

// === 1. 获取/刷新图形验证码 ===
const refreshCaptcha = async () => {
  try {
    const res = await axios.get(`/api/auth/captcha?t=${new Date().getTime()}`);
    captchaSvg.value = res.data;
    form.imgCaptcha = ''; 
  } catch (error) {
    console.error("图形验证码加载失败");
  }
};

onMounted(() => {
  refreshCaptcha();
});

// 监控角色变化
watch(() => form.role, (newRole) => {
  if (newRole !== 2) form.userType = null;
  // 如果切换了身份，清理相关校验
  if (formRef.value) {
    formRef.value.clearValidate(['userType', 'adminCode']);
  }
});

// === 校验规则函数 ===
const validatePassComplexity = (rule: any, value: any, callback: any) => {
  if (!value) return callback(new Error('请输入密码'));
  if (value.length < 8 || value.length > 20) return callback(new Error('长度需在8-20位'));
  
  if (form.username && value.includes(form.username)) {
    return callback(new Error('密码不能包含用户名'));
  }

  let count = 0;
  if (/[A-Z]/.test(value)) count++;
  if (/[a-z]/.test(value)) count++;
  if (/[0-9]/.test(value)) count++;
  if (/[^A-Za-z0-9]/.test(value)) count++;
  
  if (count < 3) callback(new Error('需包含大小写字母、数字、符号中至少3种'));
  else callback();
};

const validatePass2 = (rule: any, value: any, callback: any) => {
  if (value !== form.password) callback(new Error('两次输入密码不一致!'));
  else callback();
};

const validateUserType = (rule: any, value: any, callback: any) => {
  if (form.role === 2 && value === null) callback(new Error('电力需求方必须选择实体类型'));
  else callback();
};

// ✅ 新增：管理员邀请码校验
const validateAdminCode = (rule: any, value: any, callback: any) => {
  if (form.role === 0 && !value) {
    callback(new Error('注册管理员必须填写内部邀请码'));
  } else {
    callback();
  }
};

const rules = {
  role: [{ required: true, message: '请选择您的身份', trigger: 'change' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  userType: [{ validator: validateUserType, trigger: 'change' }],
  
  // ✅ 新增规则
  adminCode: [{ validator: validateAdminCode, trigger: 'blur' }],

  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' }, 
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ],
  imgCaptcha: [
    { required: true, message: '请输入图形验证码', trigger: 'blur' },
    { len: 4, message: '长度应为4位', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请输入邮件验证码', trigger: 'blur' },
    { len: 6, message: '验证码为6位数字', trigger: 'blur' }
  ],
  password: [
    { required: true, validator: validatePassComplexity, trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validatePass2, trigger: 'blur' }
  ]
};

// === 2. 发送邮件验证码 ===
const sendEmailCode = async () => {
  if (!form.email) return ElMessage.warning("请先输入邮箱");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(form.email)) return ElMessage.warning("邮箱格式不正确");

  if (!form.imgCaptcha || form.imgCaptcha.length !== 4) {
    return ElMessage.warning("请正确输入4位图形验证码");
  }

  isSending.value = true;
  try {
    await axios.post('/api/auth/send-code', { 
      email: form.email,
      captcha: form.imgCaptcha 
    });
    
    ElMessage.success("邮件验证码已发送，请查收");
    
    timer.value = 60;
    const interval = setInterval(() => {
      timer.value--;
      if (timer.value <= 0) {
        clearInterval(interval);
      }
    }, 1000);

  } catch (error: any) {
    ElMessage.error(error.response?.data?.msg || "发送失败，请检查验证码");
    refreshCaptcha();
  } finally {
    isSending.value = false;
  }
};

// === 3. 注册提交 ===
const handleRegister = async () => {
  if (!agreed.value) return ElMessage.warning("请先阅读并同意服务条款");
  if (!formRef.value) return;
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;
      try {
        const encryptedPassword = doSm2Encrypt(form.password);
        const sign = doSm3Hash(form.password);
        await axios.post('/api/auth/register', {
          username: form.username,
          email: form.email,
          password: encryptedPassword,
          code: form.code,
          role: form.role,
          userType: form.userType,
          sign: sign,
          // ✅ 仅在选择管理员时发送 adminCode，其他情况为 undefined
          adminCode: form.role === 0 ? form.adminCode : undefined
        });
        
        ElMessage.success("注册成功！请登录");
        router.push('/login');
      } catch (error: any) {
        ElMessage.error(error.response?.data?.msg || "注册失败");
      } finally {
        loading.value = false;
      }
    }
  });
};
</script>

<style scoped>
/* 背景与卡片样式 */
.auth-container { 
  display: flex; 
  justify-content: center; 
  align-items: center;
  min-height: 100vh; 
  padding: 40px 0;
  background: url('https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80') no-repeat center center;
  background-size: cover;
  position: relative;
}

.bg-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(16, 24, 39, 0.85);
  backdrop-filter: blur(4px);
}

.card { 
  width: 520px; 
  position: relative; 
  z-index: 10;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  background: rgba(255, 255, 255, 0.98);
}

.header { text-align: center; margin-bottom: 25px; }
.header h2 { margin: 0 0 5px 0; color: #303133; }
.header p { margin: 0; color: #909399; font-size: 14px; }

/* 验证码行样式 */
.captcha-row, .code-row {
  display: flex;
  gap: 10px;
  width: 100%;
  align-items: center;
}

/* 图形验证码容器 */
.captcha-img-box {
  width: 120px;
  height: 40px; /* 保持与 input 等高 */
  background-color: #f2f6fc;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.captcha-img-box:hover {
  border-color: #409EFF;
  opacity: 0.9;
}

/* 深度选择器，让 SVG 填满容器 */
.captcha-img-box :deep(svg) {
  width: 100%;
  height: 100%;
}

.link-text { color: #409EFF; cursor: pointer; font-weight: bold; }
.reg-btn { font-weight: bold; letter-spacing: 2px; height: 44px; margin-top: 10px; font-size: 16px; }
.footer-link { text-align: center; margin-top: 20px; }
.footer-link a { text-decoration: none; color: #606266; font-size: 14px; transition: color 0.2s; }
.footer-link a:hover { color: #409EFF; }
.form-tip { font-size: 12px; color: #909399; line-height: 1.4; margin-top: 4px; }
</style>