const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Op, Sequelize } = require('sequelize'); 
const AnalyticsData = require('../models/AnalyticsData');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const AuditLog = require('../models/AuditLog');
const { logAction } = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { Web3 } = require('web3');
const auth = require('../middleware/auth');
router.use(auth);
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

if (!ADMIN_PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.error("错误：请在 .env 文件中配置 ADMIN_PRIVATE_KEY 和 CONTRACT_ADDRESS");
}

const allowAuditorOnly = (req, res, next) => {
    console.log(`[权限检查] 用户ID: ${req.user.id}, 角色: ${req.user.role}`);
    // 只有角色 4 (审计员) 可以通过
    if (req.user.role === 4) {
        return next();
    }
    return res.status(403).json({ msg: "权限不足：日志仅审计员可见" });
};

// 获取日志列表 (支持分页、筛选、排序)
router.get('/logs', auth, allowAuditorOnly, async (req, res) => {
    if (req.user.role !== 4) return res.status(403).json({ msg: "权限不足" });

    const { page = 1, pageSize = 20, username, action, startDate, endDate } = req.query;
    const offset = (page - 1) * pageSize;

    // 构建查询条件
    const where = {};
    if (username) where.operatorName = { [Op.like]: `%${username}%` };
    if (action) where.action = action;
    if (startDate && endDate) {
        where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    try {
        const logs = await AuditLog.findAndCountAll({
            where,
            limit: parseInt(pageSize),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']], // 默认按时间倒序
            include: [{ model: User, attributes: ['username', 'role'] }] // 关联查询当前用户信息
        });

        res.json({
            total: logs.count,
            list: logs.rows,
            page: parseInt(page),
            pageSize: parseInt(pageSize)
        });
    } catch (err) {
        console.error("❌ 日志查询报错:", err);
        res.status(500).json({ msg: "日志查询失败" });
    }
});

// 获取简单的统计数据
router.get('/logs/stats', auth,allowAuditorOnly, async (req, res) => {
    if (req.user.role !== 4) return res.status(403).json({ msg: "权限不足" });

    try {
        // 统计今日登录数
        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);
        
        const loginCount = await AuditLog.count({
            where: {
                action: 'LOGIN',
                status: 'SUCCESS',
                createdAt: { [Op.gte]: todayStart }
            }
        });

        // 统计异常操作数 (FAIL)
        const failCount = await AuditLog.count({
            where: {
                status: 'FAIL',
                createdAt: { [Op.gte]: todayStart }
            }
        });

        res.json({ loginCount, failCount });
    } catch (err) {
        res.status(500).json({ msg: "统计失败" });
    }
});
// Auth 中间件
const authMiddleware = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ msg: '无 Token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.user.role !== 0) {
            return res.status(403).json({ msg: '无权访问' });
        }
        req.user = decoded.user;
        next();
    } catch (e) { 
        res.status(400).json({ msg: `Token 验证失败: ${e.message}` }); 
    }
};
// 配置 Ganache 连接
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:7545";
const web3 = new Web3(RPC_URL);
router.get('/chain-status', authMiddleware, async (req, res) => {
    try {
        // 1. 获取基础信息
        const blockNumber = await web3.eth.getBlockNumber();
        const chainId = await web3.eth.getChainId();
        const gasPrice = await web3.eth.getGasPrice();
        const nodeInfo = await web3.eth.getNodeInfo();
        let protocolVersion = 'Unknown';
        try { protocolVersion = await web3.eth.getProtocolVersion(); } catch (e) {}

        // 2. 获取最新区块详情
        const latestBlock = await web3.eth.getBlock('latest');
        const miner = latestBlock.miner;
        const gasLimit = latestBlock.gasLimit;

        // 3. 获取最近 10 个区块
        // 注意：Web3 v4 返回的是 BigInt，JSON.stringify 不支持 BigInt，必须转换
        const start = Number(blockNumber);
        const end = Math.max(0, start - 9);
        const promises = [];
        for (let i = start; i >= end; i--) {
            promises.push(web3.eth.getBlock(i));
        }
        const blocksRaw = await Promise.all(promises);

        // 4. 数据格式化 (处理 BigInt)
        const blocks = blocksRaw.map(b => ({
            number: Number(b.number),
            hash: b.hash,
            timestamp: Number(b.timestamp),
            transactions: b.transactions, 
            gasUsed: Number(b.gasUsed),
            gasLimit: Number(b.gasLimit)
        }));

        res.json({
            blockNumber: Number(blockNumber),
            chainId: Number(chainId),
            gasPrice: web3.utils.fromWei(gasPrice, 'gwei'),
            nodeInfo,
            protocolVersion,
            miner,
            gasLimit: Number(gasLimit),
            blocks
        });

    } catch (err) {
        console.error("区块链连接失败:", err);
        res.status(500).json({ msg: '无法连接到区块链节点' });
    }
});
// === 新增接口：获取单个区块详情 (后端代理) ===
router.get('/block/:hash', authMiddleware, async (req, res) => {
    try {
        const hash = req.params.hash;
        // 调用后端 Web3 获取区块
        const block = await web3.eth.getBlock(hash);
        
        if (!block) {
            return res.status(404).json({ msg: '区块未找到' });
        }

        // BigInt 序列化处理
        const processedBlock = {
            number: Number(block.number),
            hash: block.hash,
            parentHash: block.parentHash,
            timestamp: Number(block.timestamp),
            miner: block.miner,
            gasUsed: Number(block.gasUsed),
            gasLimit: Number(block.gasLimit),
            transactions: block.transactions // 这是一个哈希数组
        };

        res.json(processedBlock);
    } catch (err) {
        console.error("获取区块详情失败:", err);
        res.status(500).json({ msg: '获取区块详情失败' });
    }
});
// --- 接口 1: 实体分析仪表盘 (读取 ent_ 前缀数据) ---
router.get('/entity-dashboard', authMiddleware, async (req, res) => {
    try {
        const recentData = await AnalyticsData.findAll({
            order: [['id', 'DESC']], limit: 100,
            include: [
                { model: User, attributes: ['userType', 'isVerified'] },
                { model: Product, attributes: ['tx_hash'] },
                { model: Order, attributes: ['tx_hash'] }
            ]
        });
        
        const pieChartData = await AnalyticsData.findAll({
            attributes: ['pred_entity_label', [Sequelize.fn('COUNT', 'id'), 'count']],
            group: ['pred_entity_label']
        });
        
        // 趋势图：使用 ent_Energy_Traded_kWh
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const lineChartData = await AnalyticsData.findAll({
            attributes: [
                [Sequelize.fn('DATE', Sequelize.col('Timestamp')), 'day'],
                // 映射：SUM(ent_Energy) -> total_energy
                [Sequelize.fn('SUM', Sequelize.col('ent_Energy_Traded_kWh')), 'total_energy'] 
            ],
            where: { Timestamp: { [Op.gte]: sevenDaysAgo } },
            group: ['day'], order: [['day', 'ASC']]
        });

        const tableData = recentData.map(d => {
            let tx_hash = null;
            if (d.Order && d.Order.tx_hash) tx_hash = d.Order.tx_hash;
            else if (d.Product && d.Product.tx_hash) tx_hash = d.Product.tx_hash;

            // 映射：将 ent_ 字段映射回前端通用的字段名
            return { 
                id: d.id,
                user_id: d.user_id,
                Timestamp: d.Timestamp,
                // 使用实体分析专用的真实标签
                userType: d.true_entity_label, 
                pred_entity_label: d.pred_entity_label,
                // 映射电量和金额
                Energy_Traded_kWh: d.ent_Energy_Traded_kWh,
                Transaction_Cost_USD: d.ent_Transaction_Cost_USD,
                
                isVerified: d.User?.isVerified, 
                tx_hash: tx_hash 
            };
        });

        res.json({ tableData, pieChartData, lineChartData });
    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: '获取实体数据失败' });
    }
});

// --- 接口 2: 风险预警仪表盘 (读取 risk_ 前缀数据) ---
router.get('/risk-dashboard', authMiddleware, async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const riskyCondition = {}; 

        const tableDataRaw = await AnalyticsData.findAll({
            where: riskyCondition,
            order: [['id', 'DESC']],
            include: [
                { model: User, attributes: ['username'] },
                { model: Product, attributes: ['tx_hash'] }, 
                { model: Order, attributes: ['tx_hash'] }
            ]
        });

        const tableData = tableDataRaw.map(d => {
            let tx_hash = null;
            if (d.Order && d.Order.tx_hash) tx_hash = d.Order.tx_hash;
            else if (d.Product && d.Product.tx_hash) tx_hash = d.Product.tx_hash;

            // 映射：将 risk_ 字段映射回前端通用字段名
            return { 
                id: d.id,
                user_id: d.user_id,
                User: d.User,
                Timestamp: d.Timestamp,
                pred_risk_label: d.pred_risk_label,
                
                // 映射电压、电流、频次 (前端展示原因时需要)
                Voltage_V: d.risk_Voltage_V,
                Current_A: d.risk_Current_A,
                daily_tx_count: d.risk_daily_tx_count,
                
                tx_hash: tx_hash 
            };
        });

        const pieChartData = await AnalyticsData.findAll({
            attributes: ['pred_risk_label', [Sequelize.fn('COUNT', 'id'), 'count']],
            group: ['pred_risk_label']
        });

        const lineChartData = await AnalyticsData.findAll({
            attributes: [
                [Sequelize.fn('DATE', Sequelize.col('Timestamp')), 'day'],
                [Sequelize.fn('COUNT', 'id'), 'risk_count']
            ],
            where: { Timestamp: { [Op.gte]: sevenDaysAgo }, ...riskyCondition },
            group: ['day'], order: [['day', 'ASC']]
        });

        const riskEntityCount = await AnalyticsData.count({
            distinct: true, col: 'user_id', where: riskyCondition
        });

        res.json({ tableData, pieChartData, lineChartData, riskEntityCount });
    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: '获取风险数据失败' });
    }
});

// --- 接口 3: 认证用户 (这是您之前缺失的部分) ---
router.post('/verify-user', auth, async (req, res) => {
    const { userId } = req.body;
    try {
        const user = await User.findByPk(userId);
        if (!user) return res.status(404).json({ msg: '用户不存在' });
        
        user.isVerified = true;
        user.lastVerifiedAt = new Date();
        await user.save();
        await logAction(
            req,
            req.user, // 操作者是管理员
            'ADMIN_VERIFY_USER',
            `审核通过了用户: ${user.username} (email: ${user.email})`,
            'SUCCESS'
        );
        res.json({ msg: '用户认证成功', user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: '操作失败' });
    }
});

// --- 接口 4: 获取未认证用户 (这是您之前缺失的部分) ---
router.get('/unverified-users', authMiddleware, async (req, res) => {
    try {
        const users = await User.findAll({
            where: {
                isVerified: false, // 只查未认证
                role: { [Op.ne]: 0 } // 排除管理员
            },
            attributes: ['id', 'username', 'email', 'role', 'userType', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: '获取未认证用户失败' });
    }
});

module.exports = router;