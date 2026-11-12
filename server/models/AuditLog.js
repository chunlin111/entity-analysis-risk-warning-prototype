const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User'); // 关联用户

const AuditLog = sequelize.define('AuditLog', {
    // 事件类型 (如: LOGIN, LOGOUT, UPDATE_PROFILE, DELETE_ORDER)
    action: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // 操作描述/详情 (如: "用户登录成功", "修改了订单 #123")
    details: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // 状态 (SUCCESS / FAIL)
    status: {
        type: DataTypes.STRING, // 'SUCCESS' | 'FAIL'
        defaultValue: 'SUCCESS'
    },
    // 操作者 IP
    ipAddress: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // 用户代理 (浏览器/设备信息)
    userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // 操作者 ID (外键)
    userId: {
        type: DataTypes.INTEGER,
        allowNull: true // 允许为null (比如登录失败时可能没拿到ID，或者匿名操作)
    },
    // 快照/备注 (存储当时的用户名，防止用户改名后查不到)
    operatorName: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    // 自动维护 createdAt (操作时间) 和 updatedAt
    timestamps: true,
    // 💡 关键：禁止通过 Sequelize 软删除，确保物理存在
    paranoid: false 
});

// 建立关联
AuditLog.belongsTo(User, { foreignKey: 'userId' });

module.exports = AuditLog;