// server/models/Product.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
// ✂️ 如果这里 require 了 User, 最好也删掉
// const User = require('./User'); // <-- 删掉这行

const Product = sequelize.define('Product', {
    // ... 您的所有字段 ...
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    type: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.FLOAT, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.INTEGER, defaultValue: 0 },
    tx_hash: { type: DataTypes.STRING, allowNull: false },
    seller_id: { type: DataTypes.INTEGER, allowNull: false }
});

// ✂️ 删除下面这行 ✂️
// Product.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });

module.exports = Product;