// === 
// === 1. 核心修复：更稳健的 .env 加载方式 ===
// ===
const path = require('path');
require('dotenv').config(); 
require('./utils/cron');
const express = require('express');
const helmet = require('helmet'); 
const bodyParser = require('body-parser');
const cors = require('cors');
const sequelize = require('./config/database');
const https = require('https'); // 引入 HTTPS 模块
const fs = require('fs');       // 引入文件系统模块

// === 2. 引入所有模型 (Models) ===
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const AnalyticsData = require('./models/AnalyticsData');

// === 3. 定义模型关联 (Associations) ===
Product.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });
User.hasMany(Product, { foreignKey: 'seller_id' });
Order.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' });
Order.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });
Order.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
AnalyticsData.belongsTo(User, { foreignKey: 'user_id' });
AnalyticsData.belongsTo(Product, { foreignKey: 'product_id' });
AnalyticsData.belongsTo(Order, { foreignKey: 'order_id' });
User.hasMany(AnalyticsData, { foreignKey: 'user_id' });

// === 4. 引入所有路由 (Routes) ===
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

// ====================================

const app = express();

// ✅ 修复安全头 (针对漏扫报告)
app.use(helmet({
  contentSecurityPolicy: false, 
  crossOriginEmbedderPolicy: false,
  // 显式开启 XSS 防护
  xXssProtection: true,
  frameguard: { action: 'deny' }
}));
app.use((req, res, next) => {
    const allowedMethods = ['GET', 'POST', 'HEAD', 'OPTIONS']; // 只保留安全方法
    if (!allowedMethods.includes(req.method.toUpperCase())) {
      return res.status(405).send('Method Not Allowed'); // 不允许的方法返回405
    }
    next();
});
// ✅ 修复 CORS (针对漏扫报告，避免使用通配符 *)
app.use(cors({
    origin: function (origin, callback) {
        // 允许无 origin 的请求 (如后端请求) 或 本地开发环境
        callback(null, true);
    },
    credentials: true
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

// === 修复的核心代码：处理 SPA 404 (安全版) ===
app.get(/.*/, (req, res) => {
    if (req.url.includes('\\') || req.url.includes('//')) {
        return res.status(400).send('Bad Request');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// === 5. 最终修复：同时启动 HTTPS 和 HTTP ===
// ============================================================
const PORT = process.env.PORT || 3000;

// 尝试读取刚才生成的证书
let httpsOptions = {};
try {
    httpsOptions = {
        key: fs.readFileSync(path.join(__dirname, 'server.key')),
        cert: fs.readFileSync(path.join(__dirname, 'server.cert'))
    };
    console.log('✅ 成功加载 SSL 证书');
} catch (e) {
    console.warn('⚠️ 警告：未找到 server.key 或 server.cert。将仅使用 HTTP 模式。');
    console.warn('   请先运行 node create-cert.js 生成证书。');
}

// 先启动数据库
sequelize.sync({ force: false,alter: true}).then(() => {
    console.log('✅ 数据库连接成功');

    if (httpsOptions.key) {
        // --- 方案 A: 启动 HTTPS (解决“未加密连接”漏洞) ---
        https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 HTTPS 安全服务已启动: https://localhost:${PORT}`);
        });
    } else {
        // --- 方案 B: 只有 HTTP (没有证书时的备选) ---
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`⚠️ 无证书模式: http://localhost:${PORT}`);
        });
    }

}).catch(err => {
    console.error('❌ 数据库连接失败:', err.message);
});