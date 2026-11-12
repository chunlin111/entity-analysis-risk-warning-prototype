const jwt = require('jsonwebtoken');
const User = require('../models/User'); // 引入 User 模型

module.exports = async function(req, res, next) {
    // 1. 获取 Token
    const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ msg: '无 Token，拒绝访问' });
    }

    try {
        const secret = process.env.JWT_SECRET || "********";
        
        // 2. 解码 Token (如果过期这里会直接报错 throw error)
        const decoded = jwt.verify(token, secret);
        
        // ============================================================
        // ✅ 核心修改 3：检查是否异地登录 (单点登录互踢)
        // ============================================================
        // 从数据库查询当前用户的最新 sessionId
        const user = await User.findByPk(decoded.user.id);
        
        if (!user) {
            return res.status(401).json({ msg: '账号或密码错误' });
        }

        // 比对 Token 里的 sessionId 和数据库里的是否一致
        if (decoded.user.sessionId !== user.sessionId) {
            return res.status(401).json({ 
                msg: '您的账号已在其他设备登录，当前会话已失效。',
                code: 'DUPLICATE_LOGIN' // 用于前端识别
            });
        }

        req.user = decoded.user;
        next();
    } catch (err) {
        // 如果是 Token 过期
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                msg: '会话已超时(30分钟无操作)，请重新登录', 
                code: 'SESSION_EXPIRED'
            });
        }
        res.status(401).json({ msg: 'Token 无效' });
    }
};
