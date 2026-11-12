const AuditLog = require('../models/AuditLog');

/**
 * 记录审计日志
 * @param {Object} req - Express 请求对象
 * @param {Object} user - 用户对象 (包含 id, email, username)
 * @param {String} action - 动作类型
 * @param {String} details - 详情描述
 * @param {String} status - 状态 'SUCCESS' 或 'FAIL'
 */
const logAction = async (req, user, action, details, status = 'SUCCESS') => {
    try {
        // 获取 IP (兼容反向代理)
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        // ✅ 核心修改：优先记录邮箱
        // 逻辑：用户对象里的邮箱 > 请求体里的邮箱 > 用户名 > 'Unknown'
        let identifier = 'Unknown';
        
        if (user && user.email) {
            identifier = user.email;
        } else if (req.body && req.body.email) {
            identifier = req.body.email; // 应对“登录失败”或“忘记密码”等场景
        } else if (user && user.username) {
            identifier = user.username;  // 实在没邮箱，才用用户名兜底
        }

        await AuditLog.create({
            userId: user ? user.id : null,
            operatorName: identifier, // 这里现在存的是邮箱
            action,
            details,
            status,
            ipAddress: ip,
            userAgent
        });
    } catch (err) {
        // 日志记录失败不应阻断主业务，但应在控制台输出
        console.error('❌ 审计日志写入失败:', err);
    }
};

module.exports = { logAction };