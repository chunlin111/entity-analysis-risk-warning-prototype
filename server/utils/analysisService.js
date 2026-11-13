const axios = require('axios');
const User = require('../models/User');
const AnalyticsData = require('../models/AnalyticsData');

// 数值 0 是有效特征；其他空值沿用原有的默认值规则。
function withNumericDefault(value, fallback) {
    return value === 0 ? value : (value || fallback);
}

let entityData = [];
let riskData = [];

try {
    entityData = require('../test_entity.json'); 
    riskData = require('../test_risk.json');
    console.log(`[AnalysisService] 数据源加载完毕: Entity ${entityData.length}, Risk ${riskData.length}`);
} catch (e) {
    console.error(`[AnalysisService] 致命错误: 无法加载 JSON 数据文件!`);
    entityData = [];
    riskData = [];
}

async function runAnalysis(userId, productId, orderId, businessData) {
    try {
        if (entityData.length === 0 || riskData.length === 0) throw new Error("数据源未加载");

        const user = await User.findByPk(userId);
        if (!user) throw new Error('用户不存在');
        const userHash = user.id.toString(); 

        // === 1. 独立采样 ===
        const crypto = require('crypto'); //符合安全标准的随机数生成

        // 使用 crypto.randomInt(min, max) 生成安全的随机索引
        // 注意：max 是不包含的（exclusive），所以直接传 length 即可
        const randomIndex = crypto.randomInt(0, riskData.length);
        const riskSample = riskData[randomIndex];

        const entitySampleIndex = crypto.randomInt(0, entityData.length);
        const entitySample = entityData[entitySampleIndex];

        // === 2. 准备实体分析数据 (Entity Source) ===
        const ent_Energy = parseFloat(withNumericDefault(entitySample.Energy_Traded_kWh, 0));
        const ent_Cost = parseFloat(withNumericDefault(entitySample.Transaction_Cost_USD, 0));
        const ent_Voltage = parseFloat(withNumericDefault(entitySample.Voltage_V, 220));
        const ent_Current = parseFloat(withNumericDefault(entitySample.Current_A, 10));
        const ent_Verified = parseInt(withNumericDefault(entitySample.Blockchain_Verified, 1), 10);
        const ent_TxCount = parseInt(withNumericDefault(entitySample.tx_count, 1), 10);
        
        let true_entity_label = parseInt(entitySample.Entity_Type_Label, 10);
        if (isNaN(true_entity_label)) true_entity_label = null;

        // === 3. 准备风险预警数据 (Risk Source) ===
        const risk_Energy = parseFloat(withNumericDefault(riskSample.Energy_Traded_kWh, ent_Energy)); // 优先用Risk表里的
        const risk_Cost = parseFloat(withNumericDefault(riskSample.Transaction_Cost_USD, ent_Cost));
        const risk_Voltage = parseFloat(withNumericDefault(riskSample.Voltage_V, 220));
        const risk_Current = parseFloat(withNumericDefault(riskSample.Current_A, 10));
        const risk_Verified = parseInt(withNumericDefault(riskSample.Blockchain_Verified, 1), 10);
        const risk_DailyTx = parseInt(withNumericDefault(riskSample.daily_tx_count, 1), 10);
        
        const risk_Res = parseFloat(withNumericDefault(riskSample.Residential_Consumption_kWh, 0));
        const risk_Com = parseFloat(withNumericDefault(riskSample.Commercial_Consumption_kWh, 0));
        const risk_Ind = parseFloat(withNumericDefault(riskSample.Industrial_Consumption_kWh, 0));

        const now = new Date();
        const timestampString = now.toISOString().replace('T', ' ').substring(0, 19);
        const dateString = now.toISOString().split('T')[0];

        // === 4. 构建 API Payload ===
        const entityPayload = [{
            Energy_Traded_kWh: ent_Energy,
            Transaction_Cost_USD: ent_Cost,
            User_Hash: entitySample.User_Hash || userHash,
            Blockchain_Verified: ent_Verified,
            tx_count: ent_TxCount,
            Voltage_V: ent_Voltage,
            Current_A: ent_Current
        }];

        const riskPayload = [{
            Energy_Traded_kWh: risk_Energy,
            Transaction_Cost_USD: risk_Cost,
            Smart_Contract_Hash: userHash,
            Blockchain_Verified: risk_Verified,
            daily_tx_count: risk_DailyTx,
            Voltage_V: risk_Voltage,
            Current_A: risk_Current,
            Residential_Consumption_kWh: risk_Res,
            Commercial_Consumption_kWh: risk_Com,
            Industrial_Consumption_kWh: risk_Ind,
            Timestamp: timestampString,
            date: dateString,
        }];

        // === 5. 调用 AI ===
        const [entityRes, riskRes] = await Promise.all([
            axios.post('http://localhost:5000/predict/entity', entityPayload),
            axios.post('http://localhost:5000/predict/risk', riskPayload)
        ]);

        let pred_entity_label = entityRes.data.entity_predictions[0].pred_entity_label;
        let pred_risk_label = riskRes.data.risk_predictions[0].pred_risk_label;

        // === 6. 分别存入数据库 ===
        await AnalyticsData.create({
            user_id: userId,
            product_id: productId,
            order_id: orderId,
            User_Hash: userHash,
            Timestamp: now,

            // 实体字段 (Ent)
            ent_Energy_Traded_kWh: ent_Energy,
            ent_Transaction_Cost_USD: ent_Cost,
            ent_Voltage_V: ent_Voltage,
            ent_Current_A: ent_Current,
            ent_Blockchain_Verified: ent_Verified,
            ent_tx_count: ent_TxCount,
            true_entity_label: true_entity_label,
            pred_entity_label: pred_entity_label,

            // 风险字段 (Risk)
            risk_Energy_Traded_kWh: risk_Energy,
            risk_Transaction_Cost_USD: risk_Cost,
            risk_Voltage_V: risk_Voltage,
            risk_Current_A: risk_Current,
            risk_Blockchain_Verified: risk_Verified,
            risk_daily_tx_count: risk_DailyTx,
            Residential_Consumption_kWh: risk_Res,
            Commercial_Consumption_kWh: risk_Com,
            Industrial_Consumption_kWh: risk_Ind,
            pred_risk_label: pred_risk_label
        });

        console.log(`[AnalysisService] 双源存储完成: Ent[${pred_entity_label}] / Risk[${pred_risk_label}]`);

    } catch (err) {
        if (err.response && err.response.data) {
             console.error("[AnalysisService] AI 报错:", err.response.data);
        } else {
             console.error("[AnalysisService] 错误:", err.message);
        }
    }
}

module.exports = { runAnalysis };
