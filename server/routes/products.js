const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { Web3 } = require('web3');
const SimpleStorageJSON = require('../SimpleStorage.json');
const { runAnalysis } = require('../utils/analysisService');
const auth = require('../middleware/auth');
const { logAction } = require('../utils/logger');
router.use(auth);
// === 核心修改：读取环境变量 ===
const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

if (!ADMIN_PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.error("❌ 错误：Products 路由未找到区块链配置，请检查 .env 文件");
}


const web3 = new Web3(RPC_URL);
const accountObj = web3.eth.accounts.privateKeyToAccount(ADMIN_PRIVATE_KEY);
web3.eth.accounts.wallet.add(accountObj);
const contract = new web3.eth.Contract(SimpleStorageJSON.abi, CONTRACT_ADDRESS);

// === Auth 中间件 ===
const authMiddleware = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ msg: '无 Token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (e) { res.status(400).json({ msg: 'Token 无效' }); }
};

// Admin 专用的中间件
const adminAuthMiddleware = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ msg: '无 Token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.user.role !== 0) {
            return res.status(403).json({ msg: '无权访问' });
        }
        req.user = decoded.user;
        next();
    } catch (e) { res.status(400).json({ msg: 'Token 无效' }); }
};

// === 路由 ===
router.post('/publish', authMiddleware, async (req, res) => {
    try {
        const { type, amount, price, description } = req.body;

        // === 新增校验逻辑 ===
        // 确保转换为数字后进行比较，防止字符串 "0" 或负数通过
        if (Number(amount) <= 0 || Number(price) <= 0) {
            return res.status(400).json({ msg: '发布失败：商品数量和价格必须大于 0' });
        }
        // ==================
        const productData = JSON.stringify({
            action: "PUBLISH", type, amount, price, publisher: req.user.id, time: Date.now()
        });


        console.log("正在后台上链...");
        const receipt = await contract.methods.storeData(productData).send({
            from: accountObj.address, gas: 3000000
            // gasPrice: '0'  // 可以设置上链花费为0
        });
        
        const newProduct = await Product.create({
            type, amount, price, description,
            tx_hash: receipt.transactionHash,
            seller_id: req.user.id,
            status: 0 
        });
        await logAction(
            req, 
            req.user, // 当前操作人
            'PUBLISH_PRODUCT', // 动作名称
            `发布商品: ${description}, 价格: ${price}, 数量: ${amount}`, // 详情
            'SUCCESS'
        );
        // runAnalysis(req.user.id, newProduct.id, null, {
        //     amount: newProduct.amount,
        //     price: newProduct.price
        // });

        res.json({ msg: '发布成功，已存证并提交审核', product: newProduct });
    } catch (err) {
        await logAction(
            req, 
            req.user, 
            'PUBLISH_PRODUCT', 
            `尝试发布商品失败: ${err.message}`, 
            'FAIL'
        );
        console.error(err);
        res.status(500).json({ msg: '区块链存证失败: ' + (err.message || err) });
    }
});

router.get('/list', authMiddleware, async (req, res) => {
    try {
        const products = await Product.findAll({
            where: { status: 1 },
            include: [{ model: User, as: 'seller', attributes: ['username', 'email'] }],
            order: [['updatedAt', 'DESC']]
        });
        res.json(products);
    } catch (err) { res.status(500).json({ msg: '获取失败' }); }
});

router.get('/my-products', authMiddleware, async (req, res) => {
    try {
        const products = await Product.findAll({
            where: { seller_id: req.user.id },
            order: [['createdAt', 'DESC']]
        });
        res.json(products);
    } catch (err) { res.status(500).json({ msg: '获取失败' }); }
});


router.get('/pending', adminAuthMiddleware, async (req, res) => { 
    try {
        const products = await Product.findAll({
            where: { status: 0 },
            include: [{ 
                model: User, 
                as: 'seller', 
                attributes: ['id', 'username', 'email', 'isVerified'] // 确保 isVerified 在查询中
            }],
            order: [['createdAt', 'ASC']],
            // 禁用 Sequelize 缓存（如果存在）
            useMaster: true 
        });
        

        res.json(products);
    } catch (err) { 
        res.status(500).json({ msg: '获取失败' }); 
    }
});

// POST /api/admin/audit (商品审核接口)
router.post('/audit', adminAuthMiddleware, async (req, res) => { 
    const { productId, action } = req.body; 

    try {
        const product = await Product.findByPk(productId);
        if (!product) return res.status(404).json({ msg: '商品不存在' });

        // 1. 确定操作动作文本 (用于日志记录)
        let actionText = '';
        if (action === 'approve') {
            product.status = 1;
            actionText = '通过';
        } else if (action === 'reject') {
            product.status = 2;
            actionText = '驳回';
        } else {
            return res.status(400).json({ msg: "无效的操作参数" });
        }

        await product.save();

        // ==================================================
        // ✅ 完善后的日志埋点
        // ==================================================
        await logAction(
            req,
            req.user, // 操作者是管理员
            'AUDIT_PRODUCT', // 修正动作名称，改为"审核商品"
            `管理员审核${actionText}了商品: (ID: ${product.id})`, // 动态记录：通过/驳回 + 商品名 + ID
            'SUCCESS'
        );

        res.json({ msg: '审核完成' });

    } catch (err) { 
        console.error(err);
        
        // ✅ 记录失败日志
        await logAction(
            req, 
            req.user, 
            'AUDIT_PRODUCT', 
            `审核商品失败 (ID: ${productId}): ${err.message}`, 
            'FAIL'
        );

        res.status(500).json({ msg: '操作失败' }); 
    }
});
router.get('/verify-transaction/:hash', authMiddleware, async (req, res) => {
    const txHash = req.params.hash;
    try {
        const tx = await web3.eth.getTransaction(txHash);
        const receipt = await web3.eth.getTransactionReceipt(txHash);

        if (!tx || !receipt) {
            return res.status(404).json({ msg: '未在链上找到该交易' });
        }

        let decodedContent = null;
        try {
            if (tx.input && tx.input.length > 10) {
                 const inputs = SimpleStorageJSON.abi.find((i) => i.name === 'storeData')?.inputs;
                 if (inputs) {
                     const decoded = web3.eth.abi.decodeParameters(inputs, '0x' + tx.input.slice(10));
                     let rawStr = decoded['0'] || decoded._dataHash;
                     // Hex转UTF8补丁
                     if (typeof rawStr === 'string' && rawStr.startsWith('0x')) {
                         try { rawStr = web3.utils.hexToUtf8(rawStr); } catch (e) {}
                     }
                     try { decodedContent = JSON.parse(rawStr); } catch (e) { decodedContent = rawStr; }
                 }
            } else {
                decodedContent = "非标准 storeData 交易";
            }
        } catch (decodeErr) {
            decodedContent = "解码失败: " + decodeErr.message;
        }

        res.json({
            status: receipt.status ? true : false,
            blockNumber: Number(tx.blockNumber),
            gasUsed: Number(receipt.gasUsed),
            from: tx.from,
            to: tx.to,
            hash: tx.hash,
            input: tx.input,
            decodedData: decodedContent
        });

    } catch (err) {
        console.error("查验失败:", err);
        res.status(500).json({ msg: '查验服务异常' });
    }
});
module.exports = router;