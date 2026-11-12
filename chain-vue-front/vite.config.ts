import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
export default defineConfig({
  plugins: [
    vue(),
    basicSsl()
  ],
  // 1. 确保 base 是根路径 '/' (这是默认值，不写也行，但不要写成 './')
  base: '/', 
  
  // 2. 确保构建输出目录是 'dist' (默认值)
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  
  // === 
  // === 核心修复：配置双代理 ===
  // ===
  server: {
    proxy: {
      // 1. 代理所有 /api 请求到 Node.js 后端
      '/api': {
        target: 'https://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      // 2. 代理所有 /ml-api 请求到 ML 后端
      '/ml-api': {
        target: 'http://localhost:5000',
        changeOrigin: true, 
        rewrite: (path) => path.replace(/^\/ml-api/, '') 
      }
    }
  }
})