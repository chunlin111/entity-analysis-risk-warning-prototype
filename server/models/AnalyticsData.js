const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AnalyticsData = sequelize.define('AnalyticsData', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    
    // === 关联信息 (真实) ===
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    product_id: { type: DataTypes.INTEGER, allowNull: true },
    order_id: { type: DataTypes.INTEGER, allowNull: true },
    User_Hash: { type: DataTypes.STRING }, // 关联用的哈希
    
    Timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },

    // ==========================================
    // 1. 实体分析专用数据 (来自 test_entity.json)
    // ==========================================
    ent_Energy_Traded_kWh: { type: DataTypes.FLOAT },
    ent_Transaction_Cost_USD: { type: DataTypes.FLOAT },
    ent_Voltage_V: { type: DataTypes.FLOAT },
    ent_Current_A: { type: DataTypes.FLOAT },
    ent_Blockchain_Verified: { type: DataTypes.INTEGER },
    ent_tx_count: { type: DataTypes.INTEGER },
    
    // ==========================================
    // 2. 风险预警专用数据 (来自 test_risk.json)
    // ==========================================
    risk_Energy_Traded_kWh: { type: DataTypes.FLOAT },
    risk_Transaction_Cost_USD: { type: DataTypes.FLOAT },
    risk_Voltage_V: { type: DataTypes.FLOAT },
    risk_Current_A: { type: DataTypes.FLOAT },
    risk_Blockchain_Verified: { type: DataTypes.INTEGER },
    risk_daily_tx_count: { type: DataTypes.INTEGER },
    
    // === 风险独有特征 ===
    Residential_Consumption_kWh: { type: DataTypes.FLOAT },
    Commercial_Consumption_kWh: { type: DataTypes.FLOAT },
    Industrial_Consumption_kWh: { type: DataTypes.FLOAT },

    // === AI 结果 ===
    true_entity_label: { type: DataTypes.INTEGER, allowNull: true }, 
    pred_entity_label: { type: DataTypes.INTEGER, allowNull: true },
    pred_risk_label: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = AnalyticsData;