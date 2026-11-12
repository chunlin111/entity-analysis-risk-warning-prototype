<template>
    <el-dialog
      v-model="visible"
      title="服务条款与隐私政策"
      width="600px"
      :before-close="handleClose"
      class="terms-modal"
    >
      <div class="terms-content">
        <h3>1. 服务条款 (Terms of Service)</h3>
        <p>欢迎使用多维跨链的能源电力区块链生态实体关系分析与风险预警原型系统。使用本服务即表示您同意：</p>
        <ul>
          <li><strong>账户安全：</strong>您有责任保管好您的私钥。因私钥丢失导致的资产损失，平台无法找回。</li>
          <li><strong>合规交易：</strong>严禁利用本平台进行洗钱、非法集资等违法活动。</li>
          <li><strong>不可篡改性：</strong>区块链交易一旦上链即不可撤销，请在操作前仔细核对。</li>
        </ul>
  
        <h3>2. 隐私政策 (Privacy Policy)</h3>
        <p>我们要收集什么信息？</p>
        <ul>
          <li><strong>基本信息：</strong>邮箱、用户名（用于身份验证）。</li>
          <li><strong>链上数据：</strong>您的钱包地址、交易记录将永久公开存储在区块链上，这是区块链的技术特性。</li>
        </ul>
        <p>我们承诺不会向第三方出售您的个人敏感数据（邮箱、密码）。</p>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="handleConfirm">我已阅读并同意</el-button>
        </span>
      </template>
    </el-dialog>
  </template>
  
  <script setup lang="ts">
  import { computed } from 'vue';
  
  const props = defineProps(['modelValue']);
  const emit = defineEmits(['update:modelValue', 'agree']);
  
  const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  });
  
  const handleClose = () => {
    visible.value = false;
  };
  
  const handleConfirm = () => {
    visible.value = false;
    emit('agree');
  };
  </script>
  
  <style scoped>
  .terms-content { max-height: 400px; overflow-y: auto; line-height: 1.6; color: #606266; }
  .terms-content h3 { margin-top: 20px; color: #303133; border-bottom: 1px solid #eee; padding-bottom: 5px; }
  .terms-content ul { padding-left: 20px; }
  </style>