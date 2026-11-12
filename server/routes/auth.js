const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { decrypt, sm3Hash, dbHash } = require('../utils/smCrypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const svgCaptcha = require('svg-captcha'); 
const { v4: uuidv4 } = require('uuid');
const { logAction } = require('../utils/logger');
const authMiddleware = require('../middleware/auth');
const PASSWORD_EXPIRY_DAYS = 90; //密码过期时间
const MAX_LOGIN_ATTEMPTS = 5; // 最大失败次数
const LOCK_TIME = 120 * 60 * 1000; // 锁定时间 120分钟 (毫秒)
const ADMIN_INVITE_SECRET = process.env.ADMIN_INVITE_CODE
const session = require('express-session');
router.use(session({
    secret: '********', // 建议改为复杂的随机字符串
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: true, // 如果是 https，这里要改为 true
        maxAge: 30 * 60 * 1000 // Session 有效期30分钟
    }
}));
router.get('/captcha', (req, res) => {
    const captcha = svgCaptcha.create({
        size: 4,            // 验证码长度 (满足 >= 4)
        ignoreChars: '0o1i', // 排除容易混淆的字符
        noise: 3,           // 干扰线条数 (满足干扰处理)
        color: true,        // 验证码字符是否有颜色
        background: '#f0f2f5' // 背景色
    });

    // 将验证码的正确答案存入 Session (转为小写，忽略大小写)
    req.session.captcha = captcha.text.toLowerCase();
    
    // 返回 SVG 图片数据
    res.type('svg');
    res.status(200).send(captcha.data);
});
// === 1. 配置邮件发送器 ===
const transporter = nodemailer.createTransport({
    service: 'qq', // QQ 邮箱直接用 service 简写即可
    auth: {
        user: process.env.EMAIL_USER, // 从 .env 读取: ********
        pass: process.env.EMAIL_PASS  // 从 .env 读取: ********
    }
});

// === 2. 内存中存储验证码 (生产环境建议用 Redis) ===
// 结构: { "email": { code: "123456", expires: 1234567890 } }
const verificationCodes = new Map();

// === 3. 发送验证码接口 ===
router.post('/send-code', async (req, res) => {
    const { email, captcha } = req.body; // 前端需多传一个 captcha 字段

    if (!email) return res.status(400).json({ msg: "请输入邮箱" });

    // --- 核心校验逻辑 ---
    if (!captcha) {
        return res.status(400).json({ msg: "请输入图形验证码" });
    }
    
    // 从 Session 获取正确答案
    const sessionCaptcha = req.session.captcha;
    
    // 比对 (如果不一致，或 session 过期)
    if (!sessionCaptcha || captcha.toLowerCase() !== sessionCaptcha) {
        // 校验失败后，建议立即销毁 session 中的验证码，防止重放
        req.session.captcha = null; 
        return res.status(400).json({ msg: "图形验证码错误，请刷新重试" });
    }
    
    // 校验通过，立即销毁 session 中的图形验证码 (一次性使用)
    req.session.captcha = null;

    try {
        // 检查邮箱是否已注册
        const user = await User.findOne({ where: { email } });
        if (user) return res.status(400).json({ msg: "该邮箱已被注册" });

        // 生成6位随机验证码
        const code = String(Math.floor(100000 + Math.random() * 900000));

        // 发送邮件
        await transporter.sendMail({
            from: `"电力交易平台" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '【电力交易平台】注册验证码',
            text: `您的注册验证码是：${code}。有效期5分钟，请勿泄露给他人。`,
            html: `
                <div style="padding: 20px; background-color: #f5f5f5;">
                    <div style="background-color: white; padding: 20px; border-radius: 5px;">
                        <h3 style="color: #409EFF;">欢迎注册电力交易平台</h3>
                        <p>您的验证码是：<strong style="font-size: 20px; color: #F56C6C;">${code}</strong></p>
                        <p style="color: #909399; font-size: 12px;">有效期5分钟，如非本人操作请忽略。</p>
                    </div>
                </div>
            `
        });

        // 存入内存，设置5分钟过期
        verificationCodes.set(email, {
            code,
            expires: Date.now() + 5 * 60 * 1000
        });

        console.log(`验证码已发送至 ${email}: ${code}`); // 方便调试
        res.json({ msg: "验证码发送成功", success: true });

    } catch (err) {
        console.error("邮件发送失败:", err);
        res.status(500).json({ msg: "验证码发送失败，请检查邮箱地址或稍后重试" });
    }
});
// === 5. 发送重置密码验证码 ===
router.post('/reset-password-code', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "请输入邮箱" });

    try {
        // 1. 检查用户是否存在 (重置密码的前提是用户必须存在)
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ msg: "该邮箱尚未注册" });
        }

        // 2. 生成验证码
        const code = String(Math.floor(100000 + Math.random() * 900000));

        // 3. 发送邮件
        await transporter.sendMail({
            from: `"电力交易平台" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '【电力交易平台】重置密码验证',
            html: `
                <div style="padding: 20px;">
                    <h3>您正在申请重置密码</h3>
                    <p>您的验证码是：<strong style="color: #F56C6C; font-size: 18px;">${code}</strong></p>
                    <p style="color: #999; font-size: 12px;">有效期5分钟。如果这不是您的操作，请忽略此邮件。</p>
                </div>
            `
        });

        // 4. 存入内存 (复用 verificationCodes Map)
        verificationCodes.set(email, {
            code,
            expires: Date.now() + 5 * 60 * 1000 // 5分钟有效期
        });

        console.log(`重置验证码已发送至 ${email}: ${code}`);
        res.json({ msg: "验证码已发送", success: true });

    } catch (err) {
        console.error("发送重置验证码失败:", err);
        res.status(500).json({ msg: "邮件发送失败，请稍后重试" });
    }
});

// === 6. 执行重置密码 (带验证码校验) ===
router.post('/reset-password', async (req, res) => {
    const { email, code, newPassword, sign } = req.body;

    if (!email || !code || !newPassword) {
        return res.status(400).json({ msg: "请填写完整信息" });
    }

    try {
        // 1. 校验验证码
        const record = verificationCodes.get(email);
        if (!record) {
            return res.status(400).json({ msg: "请先获取验证码" });
        }
        if (record.code !== code) {
            return res.status(400).json({ msg: "验证码错误" });
        }
        if (Date.now() > record.expires) {
            verificationCodes.delete(email);
            return res.status(400).json({ msg: "验证码已过期，请重新获取" });
        }

        // 2. 查找用户
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ msg: "用户不存在" });
        const realPassword = decrypt(newPassword);
        if (!realPassword) {
            return res.status(400).json({ msg: "密码解密失败，数据可能被篡改" });
        }

        // B. SM3 验签 (确保前端发来的就是这个密码)
        if (sm3Hash(realPassword) !== sign) {
            return res.status(400).json({ msg: "数据签名校验失败" });
        }
        // 3. 【核心新增】校验新密码复杂度
        const passCheck = validatePassword(realPassword, user.username, user.email);
        if (!passCheck.valid) {
            return res.status(400).json({ msg: passCheck.msg });
        }

        // 4. 【核心新增】校验是否与上一次密码相同
        // bcrypt.compare(明文新密码, 数据库里的旧哈希)
        // 如果返回 true，说明新旧密码一样，必须拒绝

        // 3. 加密新密码
        const passwordToStore = dbHash(realPassword);
        const isSameAsOld = (passwordToStore == user.password);
        if (isSameAsOld) {
            return res.status(400).json({ msg: "新密码不能与当前使用的密码相同" });
        }
        // D. 更新用户密码
        user.password = passwordToStore;
        user.passwordChangedAt = new Date();
        // 4. 保存更改
        await user.save();

        // 5. 清除验证码
        verificationCodes.delete(email);
        await logAction(
            req,
            user, // 这里的 user 是从数据库查出来的
            'RESET_PASSWORD',
            `用户通过邮箱验证码重置了密码`,
            'SUCCESS'
        );
        res.json({ msg: "密码重置成功，请重新登录" });

    } catch (err) {
        await logAction(req, null, 'RESET_PASSWORD', `尝试重置 ${email} 密码失败`, 'FAIL');
        console.error("重置密码失败:", err);
        res.status(500).json({ msg: "重置失败: " + err.message });
    }
});

// ==========================================
// 🛡️ 核心安全函数：密码复杂度校验工具
// ==========================================
function validatePassword(password, username,useremail) {
    // 1. 长度校验 (8-20位)
    if (password.length < 8 || password.length > 20) {
        return { valid: false, msg: "密码长度必须在 8 到 20 位之间" };
    }

    // 2. 用户名校验 (不能包含用户名，不能与用户名相同)
    if (username) {
        if (password === username) {
            return { valid: false, msg: "密码不能与用户名相同" };
        }
        if (password.includes(username)) {
            return { valid: false, msg: "密码不能包含用户名" };
        }
    }

    if (useremail) {
        if (password === useremail) {
            return { valid: false, msg: "密码不能与邮箱相同" };
        }
        if (password.includes(useremail)) {
            return { valid: false, msg: "密码不能包含邮箱" };
        }
    }

    // 3. 复杂度校验 (大写、小写、数字、特殊字符，四选三)
    let categories = 0;
    if (/[A-Z]/.test(password)) categories++; // 大写
    if (/[a-z]/.test(password)) categories++; // 小写
    if (/[0-9]/.test(password)) categories++; // 数字
    if (/[^A-Za-z0-9]/.test(password)) categories++; // 特殊字符

    if (categories < 3) {
        return { valid: false, msg: "密码复杂度不足：需包含大写字母、小写字母、数字、特殊字符中的至少三种" };
    }

    return { valid: true };
}
// === 4. 注册接口 (包含验证码校验) ===
router.post('/register', async (req, res) => {
    const { username, email, password, sign, role, userType, code, adminCode } = req.body;
    // 1. SM2 解密
    const realPassword = decrypt(password);
    if (!realPassword) {
        return res.status(400).json({ msg: "数据解密失败，传输可能被篡改" });
    }

    // 2. SM3 验签 (完整性校验)
    const serverSign = sm3Hash(realPassword);
    if (serverSign !== sign) {
        return res.status(400).json({ msg: "数据签名校验失败，请求非法" });
    }
    // 1. 校验密码复杂度
    const passCheck = validatePassword(realPassword, username,email);
    if (!passCheck.valid) {
        return res.status(400).json({ msg: passCheck.msg });
    }
    try {
        // 1. 校验验证码
        const record = verificationCodes.get(email);
        if (!record) {
            return res.status(400).json({ msg: "请先获取验证码" });
        }
        if (record.code !== code) {
            return res.status(400).json({ msg: "验证码错误" });
        }
        if (Date.now() > record.expires) {
            verificationCodes.delete(email);
            return res.status(400).json({ msg: "验证码已过期，请重新获取" });
        }
        if (role === 0) { // 0 代表管理员
            if (!adminCode) {
                return res.status(400).json({ msg: "注册管理员必须填写邀请码" });
            }
            if (adminCode !== ADMIN_INVITE_SECRET) {
                // 记录一次失败的审计日志 (可选)
                await require('../utils/logger').logAction(req, null, 'REGISTER_FAIL', `尝试注册管理员失败，邀请码错误: ${adminCode}`, 'FAIL');
                
                return res.status(403).json({ msg: "管理员邀请码错误，拒绝注册" });
            }
        }
        // 2. 检查邮箱是否已存在 (双重检查)
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) return res.status(400).json({ msg: "该邮箱已注册" });

        // 3. 密码加密SM3
        const passwordToStore = dbHash(realPassword);
        // 4. 创建用户
        const newUser = await User.create({
            username,
            email,
            password: passwordToStore, // 密码使用sm3加密
            role,
            userType,
            isVerified: false, // 默认未认证
            lastVerifiedAt: new Date(),
            passwordChangedAt: new Date()
        });

        // 注册成功后，清除验证码
        verificationCodes.delete(email);
        res.json({ msg: "注册成功", userId: newUser.id });

    } catch (err) {
        console.error("注册报错:", err);
        res.status(500).json({ msg: "服务器错误: " + err.message });
    }
});

// 3. 登录接口 (保持不变)
router.post('/login', async (req, res) => {
    const { email, password, sign, captcha } = req.body;

    try {
        if (!captcha) {
            return res.status(400).json({ msg: "请输入验证码" });
        }
        if (!req.session.captcha || req.session.captcha !== captcha.toLowerCase()) {
            // 记录一次失败日志
            await logAction(req, null, 'LOGIN', `登录失败 ${email}: 验证码错误`, 'FAIL');
            return res.status(400).json({ msg: "验证码错误" });
        }

        // 校验通过后，立即清除验证码，防止重复使用
        req.session.captcha = null;
        // 1. 查询用户
        const user = await User.findOne({ where: { email } });
        if (!user) {
            // 记录失败日志 (此时没有 user 对象，传 null)
            await logAction(req, null, 'LOGIN', `尝试登录邮箱 ${email} 失败：用户不存在`, 'FAIL');
            return res.status(400).json({ msg: "账号或密码错误" });
        }
        // ============================================================
        // 1. 检查账户是否处于锁定状态
        // ============================================================
        if (user.lockUntil && user.lockUntil > new Date()) {
            // 计算还剩多少分钟
            const waitSeconds = Math.ceil((user.lockUntil - new Date()) / 1000);
            const waitMinutes = Math.ceil(waitSeconds / 60);
            return res.status(403).json({ 
                msg: `账户已被锁定，请在 ${waitMinutes} 分钟后重试`,
                code: "ACCOUNT_LOCKED"
            });
        }
        // 1. SM2 解密
        const realpassword = decrypt(password);
        
        if (!realpassword) {
            return res.status(400).json({ msg: "解密失败" });
        }

        // 2. SM3 验签
        if (sm3Hash(realpassword) !== sign) {
            return res.status(400).json({ msg: "签名校验失败" });
        }
        // 2. 验证密码
        const inputDbHash = dbHash(realpassword);

        const isMatch = (inputDbHash == user.password);
        if (!isMatch) {
            // --- 密码错误处理逻辑 ---
            // 如果之前已经锁定过且时间到了，重置计数器为 1 (因为这次又错了)
            // 或者如果是首次错误，直接 +1
            await logAction(req, user, 'LOGIN', '登录失败：密码错误', 'FAIL');
            if (user.lockUntil && user.lockUntil < new Date()) {
                user.loginAttempts = 1;
                user.lockUntil = null;
            } else {
                user.loginAttempts += 1;
            }

            // 检查是否达到锁定阈值
            if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
                // 设定锁定时间为：当前时间 + 30分钟
                user.lockUntil = new Date(Date.now() + LOCK_TIME);
                await user.save();
                return res.status(403).json({ 
                    msg: "密码连续错误 5 次，账户已锁定 120 分钟！" 
                });
            }

            // 未达到阈值，保存计数并提示
            await user.save();
            const remaining = MAX_LOGIN_ATTEMPTS - user.loginAttempts;
            return res.status(400).json({ 
                msg: `密码错误。再试 ${remaining} 次后将被锁定。` 
            });
        }

        // ============================================================
        // 3. 登录成功 (密码正确) -> 重置计数器
        // ============================================================
        user.loginAttempts = 0;
        user.lockUntil = null;

        // ============================================================
        // 核心修改：检查用户是否已认证
        // ============================================================
        // 如果不是管理员(role 0通常是管理员，不需要认证)，且未认证(isVerified为false)
        // 注意：如果您希望管理员也必须认证，可以去掉 user.role !== 0 这个条件
        if (user.role !== 0 && !user.isVerified) {
            return res.status(403).json({ 
                msg: "登录失败：您的账号尚未通过管理员认证，请等待审核。" 
            });
        }
        // ============================================================
        // ---------------------------------------------------------
        // ✅ 新增核心逻辑：检查密码是否过期
        // ---------------------------------------------------------
        const lastChange = new Date(user.passwordChangedAt);
        const now = new Date();
        // 计算相差的天数
        const diffTime = Math.abs(now - lastChange);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > PASSWORD_EXPIRY_DAYS) {
            // 返回特定的状态码 (如 403) 和特定的 msg，前端据此跳转
            return res.status(403).json({ 
                msg: "您的密码已过期（超过90天未修改），为了安全请立即重置密码。",
                code: "PASSWORD_EXPIRED" // 前端可用这个 code 判断
            });
        }
        await logAction(req, user, 'LOGIN', '用户登录成功', 'SUCCESS');
        const newSessionId = uuidv4(); // 生成唯一 ID
        // 3. 准备 Payload
        const payload = { 
            user: { 
                id: user.id, 
                role: user.role, 
                email: user.email,
                username: user.username,
                sessionId: newSessionId // 将会话ID放入 Token
            } 
        };
        
        const secret = process.env.JWT_SECRET || "********";
        
        // 4. 生成 Token
        jwt.sign(
            payload, 
            secret, 
            { expiresIn: '30m' }, // ⏰ 强制设置 30分钟过期
            (err, token) => {
                if (err) throw err;
                res.json({ 
                    token, 
                    role: user.role, 
                    username: user.username, 
                    msg: "登录成功" 
                });
            }
        );
        
        user.sessionId = newSessionId;
        // 顺便重置登录失败计数
        user.loginAttempts = 0;
        user.lockUntil = null;
        
        await user.save(); // 保存到数据库
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "服务器错误" });
    }
});



module.exports = router;
