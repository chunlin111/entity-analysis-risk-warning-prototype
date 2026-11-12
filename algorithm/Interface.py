from flask import Flask, request, jsonify
import pandas as pd
import lightgbm as lgb
import json
from flask_cors import CORS
import os
import sys

# 初始化Flask应用
app = Flask(__name__)
CORS(app)  # 允许跨域请求


# 全局变量：存储两个模型和对应的特征列
# 实体预测相关
model_entity = None
feature_cols_entity = None

# 风险预测相关
model_risk = None
feature_cols_risk = None
# 获取当前脚本所在的绝对路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def load_all_resources():
    """加载所有模型和特征列资源（启动时执行一次）"""
    global model_entity, feature_cols_entity, model_risk, feature_cols_risk
    
    # 1. 加载实体预测资源
    try:
        with open(os.path.join(BASE_DIR,"entity_feature_cols.json"), "r", encoding="utf-8") as f:
            feature_cols_entity = json.load(f)
        model_entity = lgb.Booster(model_file="entity_lgb_model.txt")
        print("实体预测模型及特征列加载成功")
    except Exception as e:
        print(f"实体预测资源加载失败: {str(e)}")
        raise  # 加载失败终止服务
    
    # 2. 加载风险预测资源
    try:
        with open(os.path.join(BASE_DIR,"feature_cols.json"), "r", encoding="utf-8") as f:
            feature_cols_risk = json.load(f)
        model_risk = lgb.Booster(model_file="lgb_model.txt")
        print("风险预测模型及特征列加载成功")
    except Exception as e:
        print(f"风险预测资源加载失败: {str(e)}")
        raise  # 加载失败终止服务


# 启动时加载所有资源
load_all_resources()


@app.route('/predict/entity', methods=['POST'])
def predict_entity():
    """实体类型预测接口（无需输入真实标签，仅返回预测结果）"""
    try:
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({"error": "请提供JSON格式的实体预测输入数据"}), 400
        
        # 转换为DataFrame（支持两种输入格式）
        if "features" in data:
            test_df = pd.DataFrame(data["features"])
        else:
            test_df = pd.DataFrame(data)
        
        # 验证特征列完整性（仅校验模型所需的特征列）
        missing = [c for c in feature_cols_entity if c not in test_df.columns]
        if missing:
            return jsonify({"error": f"实体预测缺少特征列: {missing}"}), 400
        
        # 提取特征（无需处理真实标签）
        X_test = test_df[feature_cols_entity]
        
        # 模型预测
        y_pred_prob = model_entity.predict(X_test)
        y_pred_cls = y_pred_prob.argmax(axis=1).tolist()
        
        # 构建返回结果（仅包含预测标签）
        result = {
            "entity_predictions": [
                {"pred_entity_label": pred}  # 只返回预测标签
                for pred in y_pred_cls
            ],
            "total_samples": len(y_pred_cls)
        }
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({"error": f"实体预测失败: {str(e)}"}), 500


@app.route('/predict/risk', methods=['POST'])
def predict_risk():
    """风险标签预测接口（无需输入真实标签，仅返回预测结果）"""
    try:
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({"error": "请提供JSON格式的风险预测输入数据"}), 400
        
        # 转换为DataFrame（支持两种输入格式）
        if "data" in data:
            test_df = pd.DataFrame(data["data"])
        else:
            test_df = pd.DataFrame(data)
        
        # 验证特征列完整性（仅校验模型所需的特征列）
        missing = [c for c in feature_cols_risk if c not in test_df.columns]
        if missing:
            return jsonify({"error": f"风险预测缺少特征列: {missing}"}), 400
        
        # 提取特征（无需处理真实标签）
        X_test = test_df[feature_cols_risk]
        
        # 模型预测
        y_pred_prob = model_risk.predict(X_test)
        y_pred_cls = y_pred_prob.argmax(axis=1).tolist()
        
        # 构建返回结果（仅包含预测标签）
        result = {
            "risk_predictions": [
                {"pred_risk_label": pred}  # 只返回预测标签
                for pred in y_pred_cls
            ],
            "total_samples": len(y_pred_cls)
        }
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({"error": f"风险预测失败: {str(e)}"}), 500


if __name__ == "__main__":
    # 启动服务（单端口同时提供两个接口）
    app.run(host="0.0.0.0", port=5000, debug=True)