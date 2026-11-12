const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { Web3 } = require('web3');
const SimpleStorageJSON = require('../SimpleStorage.json');
const auth = require('../middleware/auth');
const { logAction } = require('../utils/logger');
router.use(auth);
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

const authMiddleware = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ msg: '无 Token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (e) { res.status(400).json({ msg: 'Token error' }); }
};
const { runAnalysis } = require('../utils/analysisService');
router.post('/create', authMiddleware, async (req, res) => {
    const { product_id } = req.body;
    const buyer_id = req.user.id;

    try {
        const product = await Product.findByPk(product_id);
        if (!product) return res.status(404).json({ msg: '商品不存在' });
        if (product.status !== 1) return res.status(400).json({ msg: '商品不可交易' });

        const orderData = JSON.stringify({
            action: "BUY",
            productId: product_id,
            price: product.price,
            buyer: buyer_id,
            time: Date.now()
        });

        console.log("正在后台执行购买上链...");
        const receipt = await contract.methods.storeData(orderData).send({
            from: accountObj.address,
            gas: 3000000
            // gasPrice: '0'  // 可以设置上链花费为0
        });

        const newOrder = await Order.create({
            product_id,
            buyer_id,
            seller_id: product.seller_id,
            total_price: product.price * product.amount,
            tx_hash: receipt.transactionHash
        });

        product.status = 3; 
        await product.save();
        runAnalysis(req.user.id, product.id, newOrder.id, {
            amount: product.amount, // 使用商品数据
            price: product.price
        });
        await logAction(
            req,
            req.user,
            'CREATE_ORDER',
            `创建订单 购买商品ID: ${newOrder.product_id}，金额: ${newOrder.total_price}`,
            'SUCCESS'
        );
        res.json({ msg: '下单成功，凭证已上链', order: newOrder });
    } catch (err) {
        await logAction(req, req.user, 'CREATE_ORDER', '下单失败', 'FAIL');
        console.error(err);
        res.status(500).json({ msg: '交易失败: ' + err.message });
    }
});

router.get('/my-orders', authMiddleware, async (req, res) => {
    try {
        const orders = await Order.findAll({
            where: { buyer_id: req.user.id },
            include: [
                { model: Product, as: 'product' },
                { model: User, as: 'seller', attributes: ['email', 'username'] }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(orders);
    } catch (err) { res.status(500).json({ msg: '获取失败' }); }
});

module.exports = router;