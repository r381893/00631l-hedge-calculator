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
import csv
from datetime import datetime, timedelta
from dotenv import load_dotenv
import logging
import yahoo_scraper  # Import the new scraper logic

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
    def get_option_price(self, strike: int, option_type: str, contract: str = None) -> dict:
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

    def get_option_symbol(self, strike: int, option_type: str, target_month: int = None, target_year: int = None, root: str = "TXO") -> str:
        """產生選擇權代號"""
        if target_month and target_year:
            month, year = target_month, target_year
        else:
            month, year = self.get_contract_month_year()
            
        year_digit = str(year)[-1]
        
        # 買權 Call (A-L), 賣權 Put (M-X)
        if option_type.lower() in ['call', 'c', 'buy']:
            codes = "ABCDEFGHIJKL"
        else:
            codes = "MNOPQRSTUVWX"
            
        month_code = codes[month - 1]
        return f"{root}{strike}{month_code}{year_digit}"


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
    
    def get_option_price(self, strike: int, option_type: str, contract: str = None) -> dict:
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

        url = "https://openapi.taifex.com.tw/v1/DailyMarketReportOpt"
        headers = {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0'
        }

        logger.info("📡 正在從期交所取得選擇權資料...")

        # 簡單重試機制以應對暫時性網路或伺服器錯誤
        retries = 3
        response = None
        for attempt in range(1, retries + 1):
            try:
                response = requests.get(url, headers=headers, timeout=10)
                logger.info(f"📶 Taifex fetch attempt {attempt}, status={getattr(response, 'status_code', 'no-response')}")
                if response is not None and response.status_code == 200:
                    break
                else:
                    snippet = response.text[:500] if response is not None else ''
                    logger.warning(f"⚠️ Taifex returned status {getattr(response, 'status_code', 'N/A')}: {snippet}")
            except requests.exceptions.RequestException as e:
                logger.error(f"❌ Taifex request exception (attempt {attempt}): {e}")
            time.sleep(1)

        if response is None:
            logger.error("❌ 無法向期交所發出請求 (response is None), 轉為模擬資料")
            mock = self._generate_mock_data()
            self.cache['data'] = mock
            self.cache['timestamp'] = datetime.now()
            return mock

        if response.status_code != 200:
            logger.error(f"❌ 期交所 API 回應錯誤: {response.status_code}, 轉為模擬資料")
            mock = self._generate_mock_data()
            self.cache['data'] = mock
            self.cache['timestamp'] = datetime.now()
            return mock

        text = response.text

        # 嘗試以 CSV 解析（期交所 DailyMarketReportOpt 可能回傳 CSV）
        data = None
        try:
            sample_head = text.strip()[:200]
            is_csv = False
            # 偵測常見 CSV 標頭（中文或英文）
            csv_indicators = ['履約價', '到期', 'Contract', 'StrikePrice', '履約價', '買賣權', 'CallPut']
            for ind in csv_indicators:
                if ind in sample_head:
                    is_csv = True
                    break

            if is_csv:
                f = io.StringIO(text)
                reader = csv.DictReader(f)
                rows = []
                # 將 CSV 欄位（可能為中文）映射到預期欄位名稱

                # 精準 Mapping（依據你提供的 CSV header）
                header_map = {
                    '契約': 'Contract',
                    'Contract': 'Contract',
                    '到期月份(週別)': 'ContractMonth',
                    '到期月份': 'ContractMonth',
                    '履約價': 'StrikePrice',
                    'StrikePrice': 'StrikePrice',
                    '買賣權': 'CallPut',
                    'CallPut': 'CallPut',
                    '最後成交價': 'Close',
                    'Close': 'Close',
                    '結算價': 'SettlementPrice',
                    'SettlementPrice': 'SettlementPrice',
                    '買價': 'BestBid',
                    'BestBid': 'BestBid',
                    '賣價': 'BestAsk',
                    'BestAsk': 'BestAsk'
                }

                for r in reader:
                    norm = {}
                    for k, v in r.items():
                        if v is None:
                            continue
                        key = k.strip()
                        mapped = header_map.get(key, None)
                        val = v.strip()
                        if mapped:
                            # 轉換特定欄位格式
                            if mapped == 'StrikePrice':
                                try:
                                    norm[mapped] = float(val) if val not in ('', '-') else 0.0
                                except Exception:
                                    # 嘗試移除逗號再轉
                                    try:
                                        norm[mapped] = float(val.replace(',', ''))
                                    except Exception:
                                        norm[mapped] = 0.0
                            elif mapped == 'Close' or mapped == 'SettlementPrice' or mapped in ('BestBid', 'BestAsk'):
                                try:
                                    norm[mapped] = float(val) if val not in ('', '-') else 0.0
                                except Exception:
                                    try:
                                        norm[mapped] = float(val.replace(',', ''))
                                    except Exception:
                                        norm[mapped] = 0.0
                            elif mapped == 'ContractMonth':
                                norm[mapped] = val.replace(' ', '')
                            elif mapped == 'CallPut':
                                # Map Chinese values to Call/Put
                                if val == '買權':
                                    norm[mapped] = 'Call'
                                elif val == '賣權':
                                    norm[mapped] = 'Put'
                                else:
                                    # 可能已是英文 Call/Put
                                    norm[mapped] = 'Call' if val.lower().startswith('c') else 'Put'
                            else:
                                norm[mapped] = val
                        else:
                            norm[key] = val
                    rows.append(norm)

                data = rows
        except Exception as e:
            logger.warning(f"⚠️ CSV 解析失敗，將嘗試 JSON 解析: {e}")

        # 如果不是 CSV 或 CSV 解析失敗，嘗試 JSON
        if data is None:
            try:
                data = response.json()
            except Exception as e:
                text_snippet = text[:2000]
                logger.error(f"❌ 解析 Taifex JSON 失敗: {e} / response text snippet: {text_snippet}")
                return None

            # 如果回傳是一個物件（dict），嘗試取出內層 list
            if isinstance(data, dict):
                for candidate in ('data', 'Data', 'result', 'items'):
                    if candidate in data and isinstance(data[candidate], list):
                        data = data[candidate]
                        break

            if not isinstance(data, list):
                logger.error(f"❌ Taifex 回傳格式非清單，keys={list(data.keys()) if isinstance(data, dict) else type(data)}")
                return None

        # 輔助函式：從多個可能的欄位名稱中取值
        def get_field(item, candidates):
            for k in candidates:
                if k in item and item[k] not in (None, ''):
                    return item[k]
            # 嘗試不區分大小寫的鍵
            lower_map = {kk.lower(): vv for kk, vv in item.items()}
            for k in candidates:
                if k.lower() in lower_map and lower_map[k.lower()] not in (None, ''):
                    return lower_map[k.lower()]
            return None

        # 過濾出 TXO (臺指選擇權) 資料，容錯檢查 Contract 欄位
        txo_data = []
        for item in data:
            contract = get_field(item, ['Contract', 'contract', 'ContractName'])
            if contract and str(contract).upper().startswith('TXO'):
                txo_data.append(item)

        if not txo_data:
            logger.warning(f"⚠️ 未找到 TXO 資料，原始回傳樣本 keys: {[list(d.keys()) for d in data[:3]]}")

        # 轉換為字典格式方便查詢
        result = {}
        month, year = self.get_contract_month_year()
        target_month = f"{year}{month:02d}"

        for item in txo_data:
            contract_month = get_field(item, ['ContractMonth(Week)', 'ContractMonth', 'ContractMonthWeek', 'Contract Month']) or ''
            # 只取當月合約（比對前 6 碼 YYYYMM，且排除週選 'W'）
            # 修正：避免週選與月選 Strike Key 衝突
            s_month = str(contract_month).strip()
            if not s_month.startswith(str(target_month)[:6]) or 'W' in s_month:
                continue

            strike_val = get_field(item, ['StrikePrice', 'Strike', 'StrikePrice '])
            callput = get_field(item, ['CallPut', 'Call/Put', 'Type', 'BuySell'])

            if not strike_val or not callput:
                logger.debug(f"跳過不完整項目 keys={list(item.keys())}")
                continue

            try:
                strike_int = int(float(strike_val))
            except (ValueError, TypeError):
                logger.debug(f"無法解析 strike: {strike_val} in item keys={list(item.keys())}")
                continue

            # 支援各種表示法
            cp = str(callput).strip().lower()
            is_call = cp in ('c', 'call', '買權', 'buy')
            normalized_cp = 'C' if is_call else 'P'

            key = f"{strike_int}_{normalized_cp}"

            settlement = get_field(item, ['SettlementPrice', 'Settlement', 'Settle']) or '0'
            close = get_field(item, ['Close', 'ClosingPrice']) or '0'
            best_bid = get_field(item, ['BestBid', 'Bid']) or '0'
            best_ask = get_field(item, ['BestAsk', 'Ask']) or '0'

            try:
                bid = float(best_bid) if best_bid and best_bid != '-' else 0
                ask = float(best_ask) if best_ask and best_ask != '-' else 0
                close_p = float(close) if close and close != '-' else 0
                settle_p = float(settlement) if settlement and settlement != '-' else 0
                
                # 價格優先順序: 最新成交 > (買+賣)/2 > 買價 > 賣價 > 結算價
                if close_p > 0:
                    price = close_p
                elif bid > 0 and ask > 0:
                    price = (bid + ask) / 2
                elif bid > 0:
                    price = bid
                elif ask > 0:
                    price = ask
                else:
                    price = settle_p
            except Exception:
                price = 0

            result[key] = {
                'strike': strike_int,
                'type': 'Call' if is_call else 'Put',
                'price': price,
                'bid': bid,
                'ask': ask,
                'source': 'taifex'
            }

        # 更新快取
        self.cache['data'] = result
        self.cache['timestamp'] = datetime.now()

        logger.info(f"✅ 期交所資料取得成功，共 {len(result)} 筆")
        return result

    def _generate_mock_data(self):
        """當無法從期交所取得資料時，產生模擬選擇權資料。輸出格式與真實解析後的 result 相同。

        模擬參數可透過環境變數覆寫：
        TAIFEX_MOCK_INDEX, TAIFEX_MOCK_VOL, TAIFEX_MOCK_DTE, TAIFEX_MOCK_R
        """
        # 讀取模擬參數
        try:
            index = float(os.getenv('TAIFEX_MOCK_INDEX', '23500'))
        except Exception:
            index = 23500.0
        try:
            vol = float(os.getenv('TAIFEX_MOCK_VOL', '0.2'))
        except Exception:
            vol = 0.2
        try:
            dte = int(os.getenv('TAIFEX_MOCK_DTE', '14'))
        except Exception:
            dte = 14
        try:
            r = float(os.getenv('TAIFEX_MOCK_R', '0.015'))
        except Exception:
            r = 0.015

        # 建立履約價範圍
        span = int(os.getenv('TAIFEX_MOCK_SPAN', '1000'))
        step = int(os.getenv('TAIFEX_MOCK_STEP', '100'))
        strikes = list(range(int(index) - span, int(index) + span + 1, step))

        result = {}
        # base time value: 估算 ATM 時間價值，與波動率與到期日相關
        import math
        T = max(1, dte) / 365.0
        base_time_value = max(5.0, index * vol * math.sqrt(T) * 0.2)

        for s in strikes:
            distance = abs(index - s)
            # 時間價值簡單衰減模型
            time_value = max(1.0, base_time_value * math.exp(-distance / 800.0))

            # Call and Put
            call_price = max(0.0, index - s) + time_value
            put_price = max(0.0, s - index) + time_value

            # 建立 key 與條目
            for is_call, price in ((True, call_price), (False, put_price)):
                cp = 'C' if is_call else 'P'
                strike_int = int(s)
                key = f"{strike_int}_{cp}"
                bid = round(price * 0.97, 2)
                ask = round(price * 1.03, 2)

                result[key] = {
                    'strike': strike_int,
                    'type': 'Call' if is_call else 'Put',
                    'price': round(price, 2),
                    'bid': bid,
                    'ask': ask,
                    'source': 'taifex_mock'
                }

        logger.info(f"🔧 已產生模擬期交所資料，共 {len(result)} 筆 (index={index}, vol={vol}, dte={dte})")
        return result
    
    def get_tx_price(self) -> dict:
        """期交所無提供即時價格，回傳空值"""
        return {"price": 0, "change": 0, "change_percent": 0}
    
    def get_option_price(self, strike: int, option_type: str, contract: str = None) -> dict:
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
            
            try:
                success = getattr(response, 'is_success', None)
                if success:
                    self.is_logged_in = True
                    logger.info("✅ Fubon API 登入成功")
                else:
                    # 嘗試取得更多錯誤資訊
                    error_msg = None
                    if response is not None:
                        error_msg = getattr(response, 'message', None) or getattr(response, 'error', None) or repr(response)
                    error_msg = error_msg or "未知錯誤"
                    self.login_error_message = error_msg
                    logger.error(f"❌ Fubon API 登入失敗: {error_msg}")
            except Exception as e:
                self.login_error_message = str(e)
                logger.error(f"❌ Fubon API 登入失敗 (解析回應時錯誤): {e}")
                
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
    
    def get_option_price(self, strike: int, option_type: str, contract: str = None) -> dict:
        if not self.is_logged_in:
            return None
        
        try:
            # Default values
            root = "TXO"
            month, year = self.get_contract_month_year()

            # Handle Contract Selection
            if contract:
                now = datetime.now()
                target_date = None

                if contract == "current_week" or contract == "next_week":
                    # Calc Target Wednesday
                    # 0=Mon, 2=Wed
                    days_to_wed = (2 - now.weekday() + 7) % 7
                    target_date = now + timedelta(days=days_to_wed)
                    
                    if contract == "next_week":
                        target_date += timedelta(days=7)
                    
                    # Determine Month/Year based on Target Date
                    year = target_date.year
                    month = target_date.month
                    
                    # Determine Root (TX1, TX2, TXO, TX4, TX5)
                    first_day = target_date.replace(day=1)
                    days_to_first_wed = (2 - first_day.weekday() + 7) % 7
                    first_wed = first_day + timedelta(days=days_to_first_wed)
                    
                    day_diff = (target_date - first_wed).days
                    week_num = (day_diff // 7) + 1
                    
                    if week_num == 3:
                        root = "TXO" # Monthly contract
                    else:
                        root = f"TX{week_num}" # TX1, TX2, TX4, TX5
                
                elif contract == "current_fri" or contract == "next_fri":
                    # Calc Target Friday
                    # 4=Fri
                    days_to_fri = (4 - now.weekday() + 7) % 7
                    target_date = now + timedelta(days=days_to_fri)
                    
                    if contract == "next_fri":
                        target_date += timedelta(days=7)
                        
                    year = target_date.year
                    month = target_date.month
                    
                    # Determine Root (TXU, TXV, TXX, TXY, TXZ)
                    first_day = target_date.replace(day=1)
                    days_to_first_fri = (4 - first_day.weekday() + 7) % 7
                    first_fri = first_day + timedelta(days=days_to_first_fri)
                    
                    day_diff = (target_date - first_fri).days
                    week_num = (day_diff // 7) + 1
                    
                    roots = ['TXU', 'TXV', 'TXX', 'TXY', 'TXZ']
                    if 1 <= week_num <= 5:
                        root = roots[week_num - 1]
                    else:
                        root = "TXU" # Fallback

                elif contract == "next_month":
                    # Monthly logic override
                    month += 1
                    if month > 12:
                         month = 1
                         year += 1
                    root = "TXO"
                else: 
                     # current_month (default)
                     # Already set by get_contract_month_year()
                     root = "TXO"

            # Generate Symbol
            symbol = self.get_option_symbol(strike, option_type, target_month=month, target_year=year, root=root)
            
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
            logger.error(f"❌ 取得選擇權價格失敗 ({strike} {option_type} {contract}): {e}")
            return None


# ============ Yahoo 奇摩資料提供者 ============

class YahooDataProvider(DataProvider):
    """Yahoo 奇摩股市資料 scraper"""
    
    def __init__(self):
        self.cache = {
            'data': None,
            'index_price': None,
            'timestamp': None,
            'ttl': 60  # 快取 1 分鐘 (Scraper 不宜太頻繁)
        }
        
    def _fetch_data(self):
        # 檢查快取
        if self.cache['data'] and self.cache['timestamp']:
            elapsed = (datetime.now() - self.cache['timestamp']).total_seconds()
            if elapsed < self.cache['ttl']:
                return self.cache['data'], self.cache['index_price']
                
        logger.info("📡 正在從 Yahoo 奇摩抓取選擇權資料...")
        try:
            index_price, data = yahoo_scraper.scrape_yahoo_option_chain()
            if data:
                self.cache['data'] = data
                self.cache['index_price'] = index_price
                self.cache['timestamp'] = datetime.now()
                logger.info(f"✅ Yahoo 抓取成功，共 {len(data)} 筆，指數: {index_price}")
                return data, index_price
            else:
                logger.warning("⚠️ Yahoo 抓取回傳空資料")
                return None, None
        except Exception as e:
            logger.error(f"❌ Yahoo 抓取失敗: {e}")
            return None, None

    def get_tx_price(self) -> dict:
        _, index_price = self._fetch_data()
        price = index_price if index_price else 0
        return {
            "price": price,
            "change": 0,
            "change_percent": 0
        }

    def get_option_price(self, strike: int, option_type: str) -> dict:
        data, _ = self._fetch_data()
        if not data:
            return None
            
        call_put = 'C' if option_type.lower() == 'call' else 'P'
        key = f"{strike}_{call_put}"
        
        if key in data:
            return data[key]
        return None
        
    def is_available(self) -> bool:
        data, _ = self._fetch_data()
        return data is not None and len(data) > 0


# ============ 全域資料提供者管理 ============

# 初始化各資料提供者
mock_provider = MockDataProvider()
taifex_provider = TaifexDataProvider()
yahoo_provider = YahooDataProvider() # Initialize Yahoo Provider
fubon_provider = None

def init_fubon_provider():
    """初始化富邦 API Provider"""
    global fubon_provider
    
    user_id = os.getenv('FUBON_USER_ID')
    password = os.getenv('FUBON_PASSWORD')
    cert_path = os.getenv('FUBON_CERT_PATH')
    cert_password = os.getenv('FUBON_CERT_PASSWORD')
    api_url = os.getenv('FUBON_API_URL')
    
    # 檢查必填欄位：帳號、密碼
    if not all([user_id, password]):
        logger.info("ℹ️ 未設定富邦 API 帳號密碼，跳過初始化")
        return None
        
    # 檢查憑證欄位：如果沒有憑證路徑，也跳過初始化 (避免 SDK 崩潰)
    if not cert_path or not cert_path.strip() or not cert_password or not cert_password.strip():
        logger.info("ℹ️ 未設定富邦 API 憑證，跳過初始化 (避免 SDK Crash)")
        return None

    # 檢查憑證檔案是否存在，支援絕對與相對路徑
    raw_cert = cert_path.strip()
    tried_paths = []
    cert_abs = os.path.expanduser(raw_cert)
    tried_paths.append(cert_abs)
    if not os.path.isabs(cert_abs):
        # 嘗試相對於此模組的路徑 (api/)
        module_dir = os.path.dirname(__file__)
        alt = os.path.join(module_dir, raw_cert)
        tried_paths.append(alt)
        cert_abs = alt if os.path.exists(alt) else cert_abs

    if not os.path.exists(cert_abs):
        logger.warning(f"⚠️ 找不到憑證檔案 (嘗試過): {tried_paths}")
        return None

    # 使用解析後的絕對路徑
    cert_path = cert_abs
    
    try:
        fubon_provider = FubonDataProvider(
            user_id=user_id,
            password=password,
            cert_path=cert_path,
            cert_password=cert_password.strip(),
            api_url=api_url
        )
        return fubon_provider if fubon_provider.is_logged_in else None
    except BaseException as e:
        logger.error(f"❌ 初始化富邦 API 失敗 (嚴重錯誤): {e}")
        return None

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
    elif source == 'yahoo' and yahoo_provider.is_available(): # Add Yahoo source check
        return yahoo_provider
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
        "yahoo_available": yahoo_provider.is_available(), # Expose Yahoo status
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
    contract_code = request.args.get('contract', default=None, type=str) # e.g. "202401" or "202401W1"
    
    # 計算履約價列表
    strikes = [center + (i * step) for i in range(-price_range, price_range + 1)]
    
    # 取得資料提供者
    provider = get_provider(source, center)
    actual_source = source
    
    chain = []
    for strike in strikes:
        # Pass contract_code to get_option_price
        call_data = provider.get_option_price(strike, 'call', contract_code)
        put_data = provider.get_option_price(strike, 'put', contract_code)
        
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
    
    # 嘗試取得供應商的最新指數價格
    current_index_price = 0
    try:
        tx_data = provider.get_tx_price()
        if tx_data and 'price' in tx_data:
            current_index_price = tx_data['price']
    except Exception:
        pass

    return jsonify({
        "center_price": current_index_price,
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
    
    # 檢查 Yahoo
    if yahoo_provider.is_available():
        sources.append('yahoo')
    
    return jsonify({
        "sources": sources,
        "default": sources[0] if sources else 'mock',
        "fubon_available": fubon_provider is not None and fubon_provider.is_logged_in,
        "taifex_available": taifex_provider.is_available(),
        "yahoo_available": yahoo_provider.is_available()
    })


@app.route('/api/taifex-debug', methods=['GET'])
def taifex_debug():
    """除錯用：直接向期交所 OpenAPI 發出請求並回傳狀態碼與回應片段，方便快速定位問題。"""
    url = "https://openapi.taifex.com.tw/v1/DailyMarketReportOpt"
    headers = {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
    }
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        snippet = resp.text[:4000]
        return jsonify({
            'status_code': resp.status_code,
            'text_snippet': snippet,
            'headers': {k: v for k, v in resp.headers.items()}
        })
    except Exception as e:
        logger.error(f"❌ Taifex debug request failed: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/taifex-cache', methods=['GET'])
def taifex_cache():
    """回傳伺服器快取的 Taifex 資料摘要，方便排查快取/解析問題。"""
    cache = taifex_provider.cache if taifex_provider else None
    if not cache or not cache.get('data'):
        return jsonify({'available': False, 'message': 'no cache'}), 200

    data = cache.get('data')
    keys = list(data.keys())[:20]
    sample = {k: data[k] for k in keys}
    return jsonify({
        'available': True,
        'cached_count': len(data),
        'timestamp': cache.get('timestamp').isoformat() if cache.get('timestamp') else None,
        'sample_keys': keys,
        'sample': sample
    })


@app.route('/api/fubon-debug', methods=['GET'])
def fubon_debug():
    """回傳富邦 Provider 的狀態與相關環境變數（敏感資訊會遮蔽）。"""
    env = {
        'FUBON_USER_ID': (os.getenv('FUBON_USER_ID')[:3] + '***') if os.getenv('FUBON_USER_ID') else None,
        'FUBON_API_URL': os.getenv('FUBON_API_URL'),
        'FUBON_CERT_PATH': (os.getenv('FUBON_CERT_PATH') and ('...' + os.path.basename(os.getenv('FUBON_CERT_PATH')))) or None
    }

    info = {
        'env': env,
        'fubon_provider_exists': fubon_provider is not None,
        'fubon_logged_in': getattr(fubon_provider, 'is_logged_in', False) if fubon_provider else False,
        'fubon_login_error': getattr(fubon_provider, 'login_error_message', None) if fubon_provider else None
    }

    return jsonify(info)

# 應用程式啟動時初始化
with app.app_context():
    # 嘗試初始化富邦 API (可選)
    init_fubon_provider()
    
    # 預先載入期交所資料
    logger.info("🚀 正在預載期交所資料...")
    taifex_provider._fetch_data()

if __name__ == '__main__':
    # 嘗試綁定 PORT（如果被占用則自動嘗試下一個埠），避免需要手動 kill
    base_port = int(os.getenv('PORT', 5000))
    max_tries = 11
    started = False
    for i in range(max_tries):
        try_port = base_port + i
        try:
            logger.info(f"🚀 嘗試啟動伺服器於 port={try_port} (attempt {i+1}/{max_tries})")
            app.run(host='0.0.0.0', port=try_port, debug=True)
            started = True
            break
        except OSError as e:
            logger.warning(f"⚠️ 無法綁定 port {try_port}: {e}")
            # 等待後重試
            time.sleep(0.5)

    if not started:
        logger.error(f"❌ 無法在 ports {base_port}-{base_port+max_tries-1} 啟動伺服器，請檢查系統或防火牆設定。")
