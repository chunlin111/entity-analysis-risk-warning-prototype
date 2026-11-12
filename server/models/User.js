const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2 },
    
    // === 新增字段 ===
    // 实体类型 (0: 居民, 1: 商业, 2: 工业)
    userType: { 
        type: DataTypes.INTEGER, 
        allowNull: true // 允许管理员(role=0)不选
    },
    // 是否已认证 (KYC)
    isVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // 最后认证时间
    lastVerifiedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    passwordChangedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW // 新注册用户默认当前时间
    },// ✅ 新增：连续登录失败次数
    loginAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // ✅ 新增：锁定截止时间
    lockUntil: {
        type: DataTypes.DATE, // 如果为 null 或小于当前时间，说明未锁定
        allowNull: true
    },
    sessionId: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

module.exports = User;