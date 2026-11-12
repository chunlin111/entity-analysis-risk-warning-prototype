// server/models/Order.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
// ✂️ 删掉所有 require
// const User = require('./User');
// const Product = require('./Product');

const Order = sequelize.define('Order', {
    // ... 您的所有字段 ...
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    total_price: { type: DataTypes.FLOAT, allowNull: false },
    order_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    tx_hash: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.INTEGER, defaultValue: 0 },
    
    // 确保外键字段存在
    buyer_id: { type: DataTypes.INTEGER },
    seller_id: { type: DataTypes.INTEGER },
    product_id: { type: DataTypes.INTEGER }
});

// ✂️ 删除下面所有行 ✂️
// Order.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' });
// Order.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });
// Order.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

module.exports = Order;