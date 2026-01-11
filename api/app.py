"""
選擇權報價 API
使用富邦證券 SDK 取得即時選擇權報價
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)  # 允許跨域請求

# 全域變數：富邦 API Provider
fubon_provider = None

def get_contract_month_year():
    """
    計算正確的合約月份和年份
    如果今天在當月第三個週三之後，則使用下個月
    """
    now = datetime.now()
    year = now.year
    month = now.month
    
    # 計算當月第三個週三
    first_day = now.replace(day=1)
    first_day_weekday = first_day.weekday()
    days_to_first_wed = (2 - first_day_weekday + 7) % 7
    first_wed_date = 1 + days_to_first_wed
    third_wed_date = first_wed_date + 14
    
    # 如果今天在第三個週三之後，移到下個月
    if now.day > third_wed_date:
        month += 1
        if month > 12:
            month = 1
            year += 1
            
    return month, year

def init_fubon_provider():
    """初始化富邦 API Provider"""
    global fubon_provider
    
    # 檢查是否有環境變數
    user_id = os.getenv('FUBON_USER_ID')
    password = os.getenv('FUBON_PASSWORD')
    cert_path = os.getenv('FUBON_CERT_PATH')
    cert_password = os.getenv('FUBON_CERT_PASSWORD')
    api_url = os.getenv('FUBON_API_URL')  # 測試環境 URL
    
    if not all([user_id, password, cert_path, cert_password]):
        print("⚠️ 缺少富邦 API 環境變數，將使用模擬資料")
        return None
    
    try:
        from fubon_neo.sdk import FubonSDK
        
        if api_url:
            sdk = FubonSDK(url=api_url)
        else:
            sdk = FubonSDK()
        
        response = sdk.login(user_id, password, cert_path, cert_password)
        
        if response and response.is_success:
            print("✅ 富邦 API 登入成功")
            return sdk
        else:
            error_msg = response.message if response else "未知錯誤"
            print(f"❌ 富邦 API 登入失敗: {error_msg}")
            return None
    except ImportError:
        print("⚠️ 找不到 fubon-neo 套件，將使用模擬資料")
        return None
    except Exception as e:
        print(f"❌ 富邦 API 初始化失敗: {e}")
        return None

def get_option_price_from_fubon(strike: int, option_type: str) -> dict:
    """從富邦 API 取得選擇權價格"""
    global fubon_provider
    
    month, year = get_contract_month_year()
    year_digit = str(year)[-1]
    
    if option_type.lower() == 'call':
        month_codes = "ABCDEFGHIJKL"
    else:
        month_codes = "MNOPQRSTUVWX"
    month_code = month_codes[month - 1]
    option_symbol = f"TXO{strike}{month_code}{year_digit}"
    
    result = {
        "strike": strike,
        "type": option_type,
        "symbol": option_symbol,
        "price": 0,
        "bid": 0,
        "ask": 0,
        "source": "mock"
    }
    
    if fubon_provider:
        try:
            quote = fubon_provider.marketdata.rest_client.futopt.intraday.quote(symbol=option_symbol)
            if quote:
                result["price"] = float(quote.get('lastPrice', 0))
                result["bid"] = float(quote.get('bidPrice', 0))
                result["ask"] = float(quote.get('askPrice', 0))
                result["reference"] = float(quote.get('referencePrice', 0))
                result["source"] = "fubon"
        except Exception as e:
            print(f"❌ 取得選擇權價格失敗 ({option_symbol}): {e}")
    
    return result

def get_mock_option_price(strike: int, option_type: str) -> dict:
    """模擬選擇權價格（用於測試）"""
    month, year = get_contract_month_year()
    year_digit = str(year)[-1]
    
    if option_type.lower() == 'call':
        month_codes = "ABCDEFGHIJKL"
    else:
        month_codes = "MNOPQRSTUVWX"
    month_code = month_codes[month - 1]
    option_symbol = f"TXO{strike}{month_code}{year_digit}"
    
    # 模擬價格：根據履約價與假設現價的距離計算
    current_index = 22000  # 假設現價
    diff = abs(strike - current_index)
    
    if option_type.lower() == 'call':
        # Call: 價內越多越貴
        if strike < current_index:
            base_price = (current_index - strike) + 50
        else:
            base_price = max(10, 200 - diff / 10)
    else:
        # Put: 價內越多越貴
        if strike > current_index:
            base_price = (strike - current_index) + 50
        else:
            base_price = max(10, 200 - diff / 10)
    
    return {
        "strike": strike,
        "type": option_type,
        "symbol": option_symbol,
        "price": round(base_price),
        "bid": round(base_price * 0.95),
        "ask": round(base_price * 1.05),
        "source": "mock"
    }

@app.route('/api/health', methods=['GET'])
def health():
    """健康檢查"""
    return jsonify({
        "status": "ok",
        "fubon_connected": fubon_provider is not None,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/option-price', methods=['GET'])
def get_option_price():
    """
    取得選擇權報價
    
    Parameters:
        strike (int): 履約價
        type (str): 選擇權類型 (call/put)
    
    Returns:
        JSON: 包含價格資訊的物件
    """
    strike = request.args.get('strike', type=int)
    option_type = request.args.get('type', default='call', type=str)
    
    if not strike:
        return jsonify({"error": "請提供履約價 (strike)"}), 400
    
    if option_type.lower() not in ['call', 'put']:
        return jsonify({"error": "type 必須是 call 或 put"}), 400
    
    # 嘗試從富邦 API 取得，失敗則使用模擬資料
    if fubon_provider:
        result = get_option_price_from_fubon(strike, option_type)
    else:
        result = get_mock_option_price(strike, option_type)
    
    return jsonify(result)

@app.route('/api/option-chain', methods=['GET'])
def get_option_chain():
    """
    取得選擇權鏈（多個履約價的報價）
    
    Parameters:
        center (int): 中心履約價（預設 22000）
        range (int): 上下範圍的檔數（預設 5，即上下各 5 檔）
        step (int): 每檔間距（預設 100）
    """
    center = request.args.get('center', default=22000, type=int)
    price_range = request.args.get('range', default=5, type=int)
    step = request.args.get('step', default=100, type=int)
    
    # 計算履約價列表
    strikes = [center + (i * step) for i in range(-price_range, price_range + 1)]
    
    chain = []
    for strike in strikes:
        call_data = get_mock_option_price(strike, 'call') if not fubon_provider else get_option_price_from_fubon(strike, 'call')
        put_data = get_mock_option_price(strike, 'put') if not fubon_provider else get_option_price_from_fubon(strike, 'put')
        
        chain.append({
            "strike": strike,
            "call": call_data,
            "put": put_data
        })
    
    return jsonify({
        "center": center,
        "range": price_range,
        "step": step,
        "chain": chain,
        "source": "fubon" if fubon_provider else "mock"
    })

# 應用程式啟動時初始化
with app.app_context():
    fubon_provider = init_fubon_provider()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
