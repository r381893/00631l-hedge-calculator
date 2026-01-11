"""
選擇權報價 API
整合自 Time Value Monitoring 的 DataProvider 架構
支援多資料來源：期交所 TAIFEX (預設) / 富邦證券 SDK (可選) / Mock (降級)
"""
import sys
import io

# 解決 Windows 終端機編碼問題：強制標準輸出使用 UTF-8
# 這樣可以正確顯示中文和 Emoji (如 🚀 ✅)
if sys.stdout and hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'buffer'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import abc
import random
import time
import requests
from datetime import datetime
from dotenv import load_dotenv
import logging

load_dotenv()

# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允許跨域請求

# ============ 資料提供者基底類別 ============

class DataProvider(abc.ABC):
    """Abstract base class for data providers."""

    @abc.abstractmethod
    def get_tx_price(self) -> dict:
        """取得台指期貨價格"""
        pass

    @abc.abstractmethod
    def get_option_price(self, strike: int, option_type: str) -> dict:
        """取得選擇權價格"""
        pass

    def get_contract_month_year(self) -> tuple:
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

    def get_option_symbol(self, strike: int, option_type: str) -> str:
        """產生選擇權代號"""
        month, year = self.get_contract_month_year()
        year_digit = str(year)[-1]
        month_codes = "ABCDEFGHIJKL" if option_type.lower() == 'call' else "MNOPQRSTUVWX"
        month_code = month_codes[month - 1]
        return f"TXO{strike}{month_code}{year_digit}"


# ============ Mock 資料提供者 ============

class MockDataProvider(DataProvider):
    """模擬資料提供者（用於測試或降級）"""
    
    def __init__(self, initial_tx_price: float = 23000.0):
        self.current_tx_price = initial_tx_price
        self.is_logged_in = True
        
    def set_tx_price(self, price: float):
        """設定當前指數（用於外部更新）"""
        self.current_tx_price = price
    
    def get_tx_price(self) -> dict:
        return {
            "price": round(self.current_tx_price, 0), 
            "change": 0, 
            "change_percent": 0
        }
    
    def get_option_price(self, strike: int, option_type: str) -> dict:
        """
        模擬選擇權價格（基於 Time Value 的邏輯）
        
        公式：
        - 內含價值 = max(0, 現價-履約價) for Call / max(0, 履約價-現價) for Put
        - 時間價值 = max(0, 100 - distance * 0.2) + random(-2, 2)
        - 總價 = 內含價值 + 時間價值
        """
        tx_price = self.current_tx_price
        
        if option_type.lower() == 'call':
            intrinsic = max(0, tx_price - strike)
        else:
            intrinsic = max(0, strike - tx_price)
        
        distance = abs(tx_price - strike)
        
        # 時間價值公式 (根據 Time Value 邏輯調整)
        # ATM 時間價值約 250-300 點
        base_time_value = 280
        decay_rate = 0.5  # 每 100 點距離減少 50 點時間價值
        time_value = max(5, base_time_value - distance * decay_rate / 100)
        
        # 加入輕微隨機性
        random.seed(strike + (1 if option_type.lower() == 'call' else 0))
        time_value += random.uniform(-5, 5)
        
        price = intrinsic + time_value
        price = round(max(1.0, price), 0)
        
        return {
            "strike": strike,
            "type": option_type.capitalize(),
            "symbol": self.get_option_symbol(strike, option_type),
            "price": price,
            "bid": round(price * 0.97),
            "ask": round(price * 1.03),
            "source": "mock"
        }


# ============ 期交所 TAIFEX 資料提供者 ============

class TaifexDataProvider(DataProvider):
    """期交所 OpenAPI 資料提供者"""
    
    def __init__(self):
        self.cache = {
            'data': None,
            'timestamp': None,
            'ttl': 300  # 快取 5 分鐘
        }
        self.is_logged_in = True
    
    def _fetch_data(self):
        """從期交所 OpenAPI 取得選擇權每日行情"""
        # 檢查快取是否有效
        if self.cache['data'] and self.cache['timestamp']:
            elapsed = (datetime.now() - self.cache['timestamp']).total_seconds()
            if elapsed < self.cache['ttl']:
                return self.cache['data']
        
        try:
            url = "https://openapi.taifex.com.tw/v1/DailyMarketReportOpt"
            headers = {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            }
            
            logger.info("📡 正在從期交所取得選擇權資料...")
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                # 過濾出 TXO (臺指選擇權) 資料
                txo_data = [item for item in data if item.get('Contract') == 'TXO']
                
                # 轉換為字典格式方便查詢
                result = {}
                month, year = self.get_contract_month_year()
                target_month = f"{year}{month:02d}"
                
                for item in txo_data:
                    contract_month = item.get('ContractMonth(Week)', '')
                    # 只取當月合約
                    if contract_month.startswith(target_month[:6]):
                        strike = item.get('StrikePrice', '')
                        call_put = item.get('CallPut', '')
                        
                        if strike and call_put:
                            try:
                                strike_int = int(float(strike))
                                
                                # 支援中文 "買權"/"賣權" 或英文 "C"/"P"
                                is_call = call_put == 'C' or call_put == '買權'
                                normalized_cp = 'C' if is_call else 'P'
                                
                                key = f"{strike_int}_{normalized_cp}"
                                
                                settlement = item.get('SettlementPrice', '0')
                                close = item.get('Close', '0')
                                best_bid = item.get('BestBid', '0')
                                best_ask = item.get('BestAsk', '0')
                                
                                price = float(close) if close and close != '-' else float(settlement) if settlement and settlement != '-' else 0
                                bid = float(best_bid) if best_bid and best_bid != '-' else 0
                                ask = float(best_ask) if best_ask and best_ask != '-' else 0
                                
                                result[key] = {
                                    'strike': strike_int,
                                    'type': 'Call' if is_call else 'Put',
                                    'price': price,
                                    'bid': bid,
                                    'ask': ask,
                                    'source': 'taifex'
                                }
                            except (ValueError, TypeError):
                                continue
                
                # 更新快取
                self.cache['data'] = result
                self.cache['timestamp'] = datetime.now()
                
                logger.info(f"✅ 期交所資料取得成功，共 {len(result)} 筆")
                return result
            else:
                logger.error(f"❌ 期交所 API 回應錯誤: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"❌ 期交所 API 請求失敗: {e}")
            return None
    
    def get_tx_price(self) -> dict:
        """期交所無提供即時價格，回傳空值"""
        return {"price": 0, "change": 0, "change_percent": 0}
    
    def get_option_price(self, strike: int, option_type: str) -> dict:
        data = self._fetch_data()
        
        call_put = 'C' if option_type.lower() == 'call' else 'P'
        key = f"{strike}_{call_put}"
        
        if data and key in data:
            item = data[key]
            return {
                "strike": strike,
                "type": option_type.capitalize(),
                "symbol": self.get_option_symbol(strike, option_type),
                "price": item['price'],
                "bid": item['bid'],
                "ask": item['ask'],
                "source": "taifex"
            }
        
        # 找不到資料
        return None
    
    def is_available(self) -> bool:
        """檢查期交所資料是否可用"""
        data = self._fetch_data()
        return data is not None and len(data) > 0


# ============ 富邦證券資料提供者 ============

class FubonDataProvider(DataProvider):
    """富邦證券 SDK 資料提供者"""
    
    def __init__(self, user_id, password, cert_path, cert_password, api_url=None):
        self.user_id = user_id
        self.password = password
        self.cert_path = cert_path
        self.cert_password = cert_password
        self.api_url = api_url
        self.api = None
        self.is_logged_in = False
        self.login_error_message = None
        self._login()
    
    def _login(self):
        try:
            from fubon_neo.sdk import FubonSDK
            
            if self.api_url:
                self.api = FubonSDK(url=self.api_url)
            else:
                self.api = FubonSDK()
            
            response = self.api.login(
                self.user_id, 
                self.password, 
                self.cert_path, 
                self.cert_password
            )
            
            if response and response.is_success:
                self.is_logged_in = True
                logger.info("✅ Fubon API 登入成功")
            else:
                error_msg = response.message if response else "未知錯誤"
                self.login_error_message = error_msg
                logger.error(f"❌ Fubon API 登入失敗: {error_msg}")
                
        except ImportError:
            self.login_error_message = "找不到 fubon-neo 套件"
            logger.warning("⚠️ 未安裝 fubon-neo 套件")
        except Exception as e:
            self.login_error_message = str(e)
            logger.error(f"❌ Fubon API 登入錯誤: {e}")
    
    def _is_night_session(self) -> bool:
        """檢查是否為夜盤時段 (15:00 - 05:00)"""
        hour = datetime.now().hour
        return hour >= 15 or hour < 5
    
    def _get_quote_safe(self, symbol: str) -> dict:
        """安全取得報價（自動處理日夜盤）"""
        if not self.is_logged_in:
            return {}
        
        is_night = self._is_night_session()
        
        # 嘗試主要盤別
        try:
            if is_night:
                quote = self.api.marketdata.rest_client.futopt.intraday.quote(
                    symbol=symbol, session='afterhours'
                )
            else:
                quote = self.api.marketdata.rest_client.futopt.intraday.quote(symbol=symbol)
            
            if quote and 'lastPrice' in quote and quote['lastPrice'] > 0:
                return quote
        except Exception:
            pass
        
        # 嘗試次要盤別
        try:
            if is_night:
                quote = self.api.marketdata.rest_client.futopt.intraday.quote(symbol=symbol)
            else:
                quote = self.api.marketdata.rest_client.futopt.intraday.quote(
                    symbol=symbol, session='afterhours'
                )
            
            if quote and 'lastPrice' in quote and quote['lastPrice'] > 0:
                return quote
        except Exception:
            pass
        
        return {}
    
    def get_tx_price(self) -> dict:
        if not self.is_logged_in:
            return {"price": 0, "change": 0, "change_percent": 0}
        
        try:
            month_codes = "ABCDEFGHIJKL"
            month, year = self.get_contract_month_year()
            year_digit = str(year)[-1]
            month_code = month_codes[month - 1]
            symbol = f"TXF{month_code}{year_digit}"
            
            quote = self._get_quote_safe(symbol)
            
            if quote and 'lastPrice' in quote and quote['lastPrice'] > 0:
                return {
                    "price": float(quote['lastPrice']),
                    "change": float(quote.get('change', 0)),
                    "change_percent": float(quote.get('changePercent', 0))
                }
            elif quote and 'referencePrice' in quote:
                return {
                    "price": float(quote.get('referencePrice', 0)),
                    "change": 0,
                    "change_percent": 0
                }
            return {"price": 0, "change": 0, "change_percent": 0}
        except Exception as e:
            logger.error(f"❌ 取得期貨價格失敗: {e}")
            return {"price": 0, "change": 0, "change_percent": 0}
    
    def get_option_price(self, strike: int, option_type: str) -> dict:
        if not self.is_logged_in:
            return None
        
        try:
            symbol = self.get_option_symbol(strike, option_type)
            quote = self._get_quote_safe(symbol)
            
            if quote and 'lastPrice' in quote and quote['lastPrice'] > 0:
                return {
                    "strike": strike,
                    "type": option_type.capitalize(),
                    "symbol": symbol,
                    "price": float(quote['lastPrice']),
                    "bid": float(quote.get('bidPrice', 0)),
                    "ask": float(quote.get('askPrice', 0)),
                    "source": "fubon"
                }
            elif quote and 'referencePrice' in quote:
                return {
                    "strike": strike,
                    "type": option_type.capitalize(),
                    "symbol": symbol,
                    "price": float(quote.get('referencePrice', 0)),
                    "bid": 0,
                    "ask": 0,
                    "source": "fubon"
                }
            return None
        except Exception as e:
            logger.error(f"❌ 取得選擇權價格失敗 ({strike} {option_type}): {e}")
            return None


# ============ 全域資料提供者管理 ============

# 初始化各資料提供者
mock_provider = MockDataProvider()
taifex_provider = TaifexDataProvider()
fubon_provider = None

def init_fubon_provider():
    """初始化富邦 API Provider"""
    global fubon_provider
    
    user_id = os.getenv('FUBON_USER_ID')
    password = os.getenv('FUBON_PASSWORD')
    cert_path = os.getenv('FUBON_CERT_PATH', '')
    cert_password = os.getenv('FUBON_CERT_PASSWORD', '')
    api_url = os.getenv('FUBON_API_URL')
    
    if not all([user_id, password]):
        logger.info("[INFO] 未設定富邦 API 憑證")
        return None
    
    fubon_provider = FubonDataProvider(
        user_id=user_id,
        password=password,
        cert_path=cert_path,
        cert_password=cert_password,
        api_url=api_url
    )
    
    return fubon_provider if fubon_provider.is_logged_in else None

def get_provider(source: str, center: int = None) -> DataProvider:
    """根據指定來源取得對應的資料提供者"""
    global mock_provider
    
    # 更新 mock 的現價
    if center:
        mock_provider.set_tx_price(center)
    
    if source == 'fubon' and fubon_provider and fubon_provider.is_logged_in:
        return fubon_provider
    elif source == 'taifex' and taifex_provider.is_available():
        return taifex_provider
    else:
        return mock_provider


# ============ API 路由 ============

@app.route('/api/health', methods=['GET'])
def health():
    """健康檢查"""
    return jsonify({
        "status": "ok",
        "fubon_connected": fubon_provider is not None and fubon_provider.is_logged_in,
        "taifex_available": taifex_provider.is_available(),
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/option-price', methods=['GET'])
def get_option_price():
    """
    取得選擇權報價
    
    Parameters:
        strike (int): 履約價
        type (str): 選擇權類型 (call/put)
        source (str): 資料來源 (taifex/fubon/mock)，預設 taifex
        center (int): 現價（用於 mock 計算）
    """
    strike = request.args.get('strike', type=int)
    option_type = request.args.get('type', default='call', type=str)
    source = request.args.get('source', default='taifex', type=str)
    center = request.args.get('center', type=int)
    
    if not strike:
        return jsonify({"error": "請提供履約價 (strike)"}), 400
    
    if option_type.lower() not in ['call', 'put']:
        return jsonify({"error": "type 必須是 call 或 put"}), 400
    
    provider = get_provider(source, center)
    result = provider.get_option_price(strike, option_type)
    
    # 如果主要來源無資料，降級到 mock
    if result is None:
        result = mock_provider.get_option_price(strike, option_type)
    
    return jsonify(result)

@app.route('/api/option-chain', methods=['GET'])
def get_option_chain():
    """
    取得選擇權鏈（多個履約價的報價）
    
    Parameters:
        center (int): 中心履約價（預設 23000）
        range (int): 上下範圍的檔數（預設 10）
        step (int): 每檔間距（預設 100）
        source (str): 資料來源 (taifex/fubon/mock)，預設 taifex
    """
    center = request.args.get('center', default=23000, type=int)
    price_range = request.args.get('range', default=10, type=int)
    step = request.args.get('step', default=100, type=int)
    source = request.args.get('source', default='taifex', type=str)
    
    # 計算履約價列表
    strikes = [center + (i * step) for i in range(-price_range, price_range + 1)]
    
    # 取得資料提供者
    provider = get_provider(source, center)
    actual_source = source
    
    chain = []
    for strike in strikes:
        call_data = provider.get_option_price(strike, 'call')
        put_data = provider.get_option_price(strike, 'put')
        
        # 如果主要來源無資料，降級到 mock
        if call_data is None:
            call_data = mock_provider.get_option_price(strike, 'call')
            actual_source = 'mock'
        if put_data is None:
            put_data = mock_provider.get_option_price(strike, 'put')
            actual_source = 'mock'
        
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
        "source": actual_source,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/sources', methods=['GET'])
def get_available_sources():
    """取得可用的資料來源列表"""
    sources = ['mock']  # mock 永遠可用
    
    # 檢查期交所
    if taifex_provider.is_available():
        sources.insert(0, 'taifex')
    
    # 檢查富邦
    if fubon_provider and fubon_provider.is_logged_in:
        sources.append('fubon')
    
    return jsonify({
        "sources": sources,
        "default": sources[0] if sources else 'mock',
        "fubon_available": fubon_provider is not None and fubon_provider.is_logged_in,
        "taifex_available": taifex_provider.is_available()
    })

# 應用程式啟動時初始化
with app.app_context():
    # 嘗試初始化富邦 API (可選)
    init_fubon_provider()
    
    # 預先載入期交所資料
    logger.info("🚀 正在預載期交所資料...")
    taifex_provider._fetch_data()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
