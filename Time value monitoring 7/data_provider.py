import abc
import random
import time
from typing import Dict, Optional
import yfinance as yf
import yfinance as yf
import pandas as pd
import requests
from datetime import datetime

class DataProvider(abc.ABC):
    """Abstract base class for data providers."""

    @abc.abstractmethod
    def get_tx_price(self) -> Dict:
        pass

    @abc.abstractmethod
    def get_option_price(self, strike: int, option_type: str) -> float:
        pass

    @abc.abstractmethod
    def get_volatility(self) -> float:
        pass

class MockDataProvider(DataProvider):
    def __init__(self, initial_tx_price: float = 15000.0):
        self.current_tx_price = initial_tx_price
        self.current_vix = 20.0
        self.last_update_time = time.time()
        self.is_logged_in = True # Mock is always logged in
        self.login_error_message = None
        self.use_websocket = False # Mock doesn't use real WS
        self.is_logged_in = True # Mock is always logged in
        self.login_error_message = None
        self.use_websocket = False # Mock doesn't use real WS

    def _update_price(self):
        now = time.time()
        if now - self.last_update_time > 1:
            change = random.uniform(-10, 10)
            self.current_tx_price += change
            vix_change = random.uniform(-0.5, 0.5) + (20 - self.current_vix) * 0.05
            self.current_vix += vix_change
            self.last_update_time = now

    def get_tx_price(self) -> Dict:
        self._update_price()
        return {"price": round(self.current_tx_price, 0), "change": 0, "change_percent": 0}
    
    def get_volatility(self) -> float:
        self._update_price()
        return round(self.current_vix, 2)

    def get_option_price(self, strike: int, option_type: str) -> float:
        tx_price = self.get_tx_price()
        if option_type.lower() == 'call':
            intrinsic = max(0, tx_price - strike)
        else:
            intrinsic = max(0, strike - tx_price)
        distance = abs(tx_price - strike)
        time_value = max(0, 100 - (distance * 0.2)) + random.uniform(-2, 2)
        price = intrinsic + time_value
        return round(max(1.0, price), 1)

    def get_kline_data(self, symbol: str, period: str = "1d") -> pd.DataFrame:
        # Generate fake kline data for MA calculation
        dates = pd.date_range(end=datetime.now(), periods=60, freq='D')
        data = []
        
        # Determine base price based on symbol
        if "00631L" in symbol:
            price = 200.0 # ETF Price
        else:
            price = self.current_tx_price # Index Price
            
        for _ in range(60):
            price += random.uniform(-price*0.01, price*0.01) # 1% fluctuation
            data.append(price)
        
        df = pd.DataFrame({'Close': data}, index=dates)
        return df

    def get_stock_price(self, symbol: str) -> float:
        # Fake stock price for 00631L
        return 200.0 + random.uniform(-5, 5)

    def get_price_by_symbol(self, symbol: str) -> float:
        return self.current_tx_price

    def get_quote(self, symbol: str) -> dict:
        return {'Close': self.current_tx_price, 'lastPrice': self.current_tx_price}
        
    def set_callbacks(self, on_order=None, on_fill=None):
        pass # Mock doesn't use callbacks yet, or we could simulate them


class FubonDataProvider(DataProvider):
    def __init__(self, user_id, password, cert_path, cert_password, api_url=None):
        self.user_id = user_id
        self.password = password
        self.cert_path = cert_path
        self.cert_password = cert_password
        self.api_url = api_url
        self.api = None
        self.is_logged_in = False
        self.login_error_message = None
        self.external_on_order = None
        self.external_on_fill = None
        self.quote_cache = {} # Cache for real-time quotes
        self.ws_log = [] # Debug log for WS messages
        self.use_websocket = False # Flag to control WS usage
        self._login()

    def set_callbacks(self, on_order=None, on_fill=None):
        """
        Set callbacks for real-time updates.
        on_order: function(order_info: dict)
        on_fill: function(fill_info: dict)
        """
        self.external_on_order = on_order
        self.external_on_fill = on_fill
        
        if self.api and self.is_logged_in:
            try:
                # Attempt to register callbacks with SDK
                # Note: Exact method names depend on SDK version, using common patterns
                if hasattr(self.api.futopt, 'set_on_order_callback'):
                    self.api.futopt.set_on_order_callback(self._internal_on_order)
                if hasattr(self.api.futopt, 'set_on_filled_callback'):
                    self.api.futopt.set_on_filled_callback(self._internal_on_fill)
                print("✅ 主動回報 Callback 設定完成")
            except Exception as e:
                print(f"⚠️ 設定 Callback 失敗: {e}")

    def _internal_on_order(self, code, content):
        """
        Handle raw order update from SDK.
        code: status code or message code
        content: OrderResult object
        """
        try:
            if not content:
                return

            # Parse OrderResult
            # Mapping based on user documentation
            func_type_map = {
                0: "新單",
                15: "改價",
                20: "改量",
                30: "刪單"
            }
            
            status_map = {
                4: "ACK (系統收單)",
                8: "傳送中 (後台準備)",
                10: "成功",
                113: "成功",
                30: "成功", # 刪單成功
                40: "部分成交後刪單成功",
                19: "失敗",
                29: "失敗",
                39: "失敗",
                90: "失敗"
            }

            ftype = getattr(content, 'function_type', -1)
            status = getattr(content, 'status', -1)
            order_no = getattr(content, 'order_no', '')
            seq_no = getattr(content, 'seq_no', '')
            err_msg = getattr(content, 'error_message', '')
            
            # Determine simplified status
            simple_status = "Unknown"
            if status in [10, 30, 40, 113]:
                simple_status = "Success"
            elif status in [19, 29, 39, 90]:
                simple_status = "Failed"
            elif status in [4, 8]:
                simple_status = "Pending"
            
            order_info = {
                "type": "ORDER",
                "function": func_type_map.get(ftype, f"Unknown({ftype})"),
                "status_code": status,
                "status_desc": status_map.get(status, f"Status {status}"),
                "simple_status": simple_status,
                "order_no": order_no,
                "seq_no": seq_no,
                "symbol": getattr(content, 'stock_no', ''),
                "action": str(getattr(content, 'buy_sell', '')),
                "price": getattr(content, 'price', 0),
                "quantity": getattr(content, 'quantity', 0),
                "message": err_msg if err_msg else status_map.get(status, "")
            }
            
            print(f"🔔 Order Update: {order_info['function']} - {order_info['status_desc']}")
            
            if self.external_on_order:
                self.external_on_order(order_info)
                
        except Exception as e:
            print(f"❌ Error parsing order callback: {e}")

    def _internal_on_fill(self, code, content):
        """
        Handle raw fill update from SDK.
        content: FilledData object
        """
        try:
            if not content:
                return
                
            fill_info = {
                "type": "FILL",
                "order_no": getattr(content, 'order_no', ''),
                "symbol": getattr(content, 'stock_no', ''),
                "action": str(getattr(content, 'buy_sell', '')),
                "price": getattr(content, 'filled_price', 0),
                "quantity": getattr(content, 'filled_qty', 0),
                "time": getattr(content, 'filled_time', ''),
                "seq_no": getattr(content, 'seq_no', '')
            }
            
            print(f"💰 Fill Update: {fill_info['symbol']} {fill_info['quantity']} @ {fill_info['price']}")
            
            if self.external_on_fill:
                self.external_on_fill(fill_info)
                
        except Exception as e:
            print(f"❌ Error parsing fill callback: {e}")

    def _on_quote_update(self, topic, quote):
        """Handle real-time quote updates from WebSocket"""
        try:
            # Log raw message
            from datetime import datetime
            msg = f"[{datetime.now().strftime('%H:%M:%S')}] {topic}: {str(quote)[:100]}..."
            self.ws_log.insert(0, msg)
            if len(self.ws_log) > 20:
                self.ws_log.pop()

            if 'symbol' in quote:
                quote['_recv_time'] = time.time() # Add timestamp
                self.quote_cache[quote['symbol']] = quote
                # print(f"⚡ Quote: {quote['symbol']} {quote.get('lastPrice')}")
        except Exception as e:
            print(f"❌ Quote Update Error: {e}")

    def _is_night_session(self) -> bool:
        """Check if current time is within night session hours (15:00 - 05:00 next day)"""
        from datetime import datetime
        now = datetime.now()
        hour = now.hour
        # Night session: 15:00 ~ 24:00 OR 00:00 ~ 05:00
        if hour >= 15 or hour < 5:
            return True
        return False

    def _get_quote_safe(self, symbol: str) -> dict:
        """
        Helper to get quote with automatic session fallback (Regular vs Afterhours).
        Prioritizes WebSocket cache, then Active Session REST, then Other Session REST.
        """
        # 1. Check WebSocket Cache (Must be fresh < 5s)
        if self.use_websocket and symbol in self.quote_cache:
            quote = self.quote_cache[symbol]
            recv_time = quote.get('_recv_time', 0)
            if time.time() - recv_time < 5: # Only use cache if fresh
                if 'lastPrice' in quote and quote['lastPrice'] > 0:
                    return quote
            # else:
            #     print(f"⚠️ Cache stale for {symbol}, trying REST...")

        is_night = self._is_night_session()
        
        # 2. Try Primary Session
        try:
            session = 'afterhours' if is_night else 'regular'
            # For regular, we don't pass session arg (defaults to regular)
            if is_night:
                quote = self.api.marketdata.rest_client.futopt.intraday.quote(symbol=symbol, session='afterhours')
            else:
                quote = self.api.marketdata.rest_client.futopt.intraday.quote(symbol=symbol)
                
            if quote and 'lastPrice' in quote and quote['lastPrice'] > 0:
                return quote
        except Exception:
            pass

        # 3. Try Secondary Session (Fallback)
        try:
            if is_night:
                # Fallback to regular (maybe it's 15:00:01 and night hasn't started data yet?)
                quote = self.api.marketdata.rest_client.futopt.intraday.quote(symbol=symbol)
            else:
                # Fallback to afterhours (maybe it's 08:44 and regular hasn't started?)
                quote = self.api.marketdata.rest_client.futopt.intraday.quote(symbol=symbol, session='afterhours')
                
            if quote and 'lastPrice' in quote and quote['lastPrice'] > 0:
                return quote
        except Exception as e:
            # print(f"Get quote failed for {symbol}: {e}")
            return {}

    def _get_night_session_products(self, product_type='FUTURE'):
        """
        Fetch active products for the night session (AFTERHOURS).
        """
        if not self.is_logged_in:
            return []
        try:
            # Fetch AFTERHOURS products
            res = self.api.marketdata.rest_client.futopt.intraday.products(
                type=product_type, 
                exchange='TAIFEX', 
                session='AFTERHOURS'
            )
            if res and 'data' in res:
                return res['data']
            return []
        except Exception as e:
            print(f"❌ 取得夜盤商品列表失敗: {e}")
            return []

    def _login(self):
        try:
            from fubon_neo.sdk import FubonSDK
            
            if self.api_url:
                self.api = FubonSDK(url=self.api_url)
            else:
                self.api = FubonSDK()
            
            response = self.api.login(self.user_id, self.password, self.cert_path, self.cert_password)
            
            if response and response.is_success:
                self.is_logged_in = True
                if response.data:
                    self.accounts = response.data
                print("✅ Fubon API 登入成功")
                try:
                    # Init Active Reporting (Orders)
                    try:
                        self.api.init_realtime()
                    except Exception as e:
                        print(f"⚠️ 主動回報初始化失敗 (略過): {e}")

                    # Init Market Data WebSocket
                    try:
                        if hasattr(self.api.marketdata, 'websocket_client'):
                            self.api.marketdata.websocket_client.futopt.on("quote", self._on_quote_update)
                            self.api.marketdata.websocket_client.connect()
                            import time
                            time.sleep(1) # Wait for connection
                            self.use_websocket = True
                            print("✅ 即時行情連線 (WebSocket) 初始化成功")
                        else:
                            print("⚠️ SDK 版本不支援 WebSocket Client (略過)")
                    except AttributeError as e:
                         print(f"⚠️ WebSocket Client 屬性錯誤 (可能 SDK 版本不符): {e}")
                    except Exception as e:
                        print(f"⚠️ 即時行情初始化失敗 (將使用 REST API): {e}")
                    
                    # Debug: Check Night Session Products
                    if self.use_websocket:
                        night_products = self._get_night_session_products()
                        print(f"🌃 夜盤商品數: {len(night_products)}")
                        for p in night_products:
                            if p['symbol'].startswith('TXF'):
                                print(f"   -> 夜盤 TXF: {p['symbol']} ({p['name']})")
                    
                except Exception as e:
                    print(f"⚠️ 即時行情初始化失敗: {e}")
            else:
                error_msg = response.message if response else "未知錯誤"
                self.login_error_message = f"帳號或密碼錯誤: {error_msg}"
                print(f"❌ Fubon API 登入失敗: {error_msg}")
        except ImportError:
            self.login_error_message = "找不到 fubon-neo 套件"
            print("❌ 請先安裝 fubon-neo")
        except BaseException as e:
            self.login_error_message = f"登入發生嚴重錯誤: {str(e)}"
            print(f"❌ Fubon API 登入錯誤 (BaseException): {e}")

    def _get_contract_month_year(self) -> tuple[int, int]:
        """
        Calculate the correct contract month and year for Monthly Options.
        If today is after the 3rd Wednesday of the month, return the next month.
        """
        from datetime import datetime, timedelta
        import math

        now = datetime.now()
        year = now.year
        month = now.month
        
        # Calculate 3rd Wednesday of the current month
        first_day = now.replace(day=1)
        first_day_weekday = first_day.weekday()
        days_to_first_wed = (2 - first_day_weekday + 7) % 7
        first_wed_date = 1 + days_to_first_wed
        third_wed_date = first_wed_date + 14
        
        # If today is after the 3rd Wednesday, move to next month
        if now.day > third_wed_date:
            month += 1
            if month > 12:
                month = 1
                year += 1
                
        return month, year

    def get_price_by_symbol(self, symbol: str) -> float:
        if not self.is_logged_in or not symbol:
            return 0.0
        try:
            quote = self.api.marketdata.rest_client.futopt.intraday.quote(symbol=symbol)
            if quote and 'lastPrice' in quote:
                return float(quote['lastPrice'])
            return 0.0
        except Exception as e:
            print(f"❌ 取得報價失敗 ({symbol}): {e}")
            return 0.0

    def _get_nearest_weekly_contract(self) -> tuple[int, int, int, str]:
        """
        Calculate the nearest weekly contract.
        Returns: (month, year, week_number, settlement_date_str)
        """
        from datetime import datetime, timedelta
        
        now = datetime.now()
        today = now.date()
        
        # Find this week's Wednesday
        days_to_wed = (2 - today.weekday() + 7) % 7
        # If today is Wed (days_to_wed=0) and time > 13:30, move to next Wed
        if days_to_wed == 0:
            if now.hour > 13 or (now.hour == 13 and now.minute >= 30):
                days_to_wed = 7
        
        settlement_date = today + timedelta(days=days_to_wed)
        
        # Determine which week of the month this is
        # ISO calendar week? No, Taiwan Futures uses 1st, 2nd, 3rd, 4th, 5th Wed.
        
        # Get the 1st day of the settlement month
        settlement_month_first = settlement_date.replace(day=1)
        # 1st Wed of that month
        first_day_weekday = settlement_month_first.weekday()
        days_to_first_wed = (2 - first_day_weekday + 7) % 7
        first_wed = settlement_month_first + timedelta(days=days_to_first_wed)
        
        # Calculate week number (1-based index of Wednesdays)
        # (SettlementDay - FirstWedDay) / 7 + 1
        week_number = int((settlement_date - first_wed).days / 7) + 1
        
        return settlement_date.month, settlement_date.year, week_number, settlement_date.strftime("%Y-%m-%d")

    def get_weekly_option_info(self, strike: int, option_type: str) -> Dict:
        """
        Get info for the nearest weekly option.
        Returns: {
            "price": float,
            "symbol": str,
            "settlement_date": str,
            "days_to_expiry": int,
            "volatility": float
        }
        """
        if not self.is_logged_in:
            return {}
            
        try:
            month, year, week, settlement_date_str = self._get_nearest_weekly_contract()
            year_digit = str(year)[-1]
            
            if option_type.lower() == 'call':
                month_codes = "ABCDEFGHIJKL"
            else:
                month_codes = "MNOPQRSTUVWX"
            month_code = month_codes[month - 1]
            
            # Try different symbol formats
            # Format 1: TXO{strike}{month_code}{year_digit}{week} (e.g. K54)
            # Format 2: TX{week}{strike}{month_code}{year_digit} (e.g. TX4...)
            # Format 3: TXO{strike}{month_code}{week} (e.g. K4)
            
            candidates = []
            # Only if week is NOT 3 (Monthly)
            if week != 3:
                # Try various formats for Weekly
                # Format 1: TX{week}{strike}{month_code}{year_digit} (e.g. TX423000K5) - Most likely for API
                candidates.append(f"TX{week}{strike}{month_code}{year_digit}")
                # Format 2: TXO{strike}{month_code}{year_digit}{week} (e.g. TXO23000K54)
                candidates.append(f"TXO{strike}{month_code}{year_digit}{week}")
                # Format 3: TXO{strike}{month_code}{week} (e.g. TXO23000K4)
                candidates.append(f"TXO{strike}{month_code}{week}")
                # Format 4: TXO{strike}{month_code}{year_digit}W{week}
                candidates.append(f"TXO{strike}{month_code}{year_digit}W{week}")
            else:
                # If nearest is Monthly (Week 3), use standard format
                candidates.append(f"TXO{strike}{month_code}{year_digit}")
            
            price = 0.0
            bid = 0.0
            ask = 0.0
            found_symbol = ""
            
            for sym in candidates:
                # Use safe quote fetching
                quote = self._get_quote_safe(sym)
                
                if quote and 'lastPrice' in quote and quote['lastPrice'] > 0:
                    price = float(quote['lastPrice'])
                    # Extract Bid/Ask
                    if 'lastTrade' in quote:
                        bid = float(quote['lastTrade'].get('bid', 0))
                        ask = float(quote['lastTrade'].get('ask', 0))
                    
                    found_symbol = sym
                    break
                elif quote and 'referencePrice' in quote:
                    # Found but maybe no trade today?
                    price = float(quote.get('referencePrice', 0))
                    found_symbol = sym
                    break
            
            # Calculate Days to Expiry
            from datetime import datetime
            settlement_date = datetime.strptime(settlement_date_str, "%Y-%m-%d").date()
            days_to_expiry = (settlement_date - datetime.now().date()).days
            
            change = 0.0
            if found_symbol and found_symbol in self.quote_cache:
                quote = self.quote_cache[found_symbol]
                change = float(quote.get('change', 0))
            elif quote:
                change = float(quote.get('change', 0))
                # Fallback if change is 0 but we have prices
                if change == 0 and 'lastPrice' in quote and 'referencePrice' in quote:
                    try:
                        last = float(quote['lastPrice'])
                        ref = float(quote['referencePrice'])
                        if last > 0 and ref > 0:
                            change = last - ref
                    except:
                        pass

            result = {
                "price": price,
                "change": change,
                "bid": bid,
                "ask": ask,
                "symbol": found_symbol if found_symbol else candidates[0],
                "settlement_date": settlement_date_str,
                "days_to_expiry": days_to_expiry,
                "volatility": self.get_volatility(),
                "week_number": week, # Added week number
                "tried_symbols": candidates # Debug info
            }
            return result
            
        except Exception as e:
            print(f"❌ 取得周選資訊失敗: {e}")
            return {"error": str(e)}

    def get_tx_price(self) -> Dict:
        if not self.is_logged_in:
            return {"price": 15000.0, "change": 0, "change_percent": 0}
        try:
            month_codes = "ABCDEFGHIJKL"
            month, year = self._get_contract_month_year()
            year_digit = str(year)[-1]
            month_code = month_codes[month - 1]
            symbol = f"TXF{month_code}{year_digit}"
            
            # Use safe quote fetching (handles Cache, Afterhours, Regular)
            quote = self._get_quote_safe(symbol)

            if quote and 'lastPrice' in quote and quote['lastPrice'] > 0:
                return {
                    "price": float(quote['lastPrice']),
                    "change": float(quote.get('change', 0)),
                    "change_percent": float(quote.get('changePercent', 0))
                }
            elif quote and 'referencePrice' in quote:
                price = float(quote.get('referencePrice', 15000))
                return {"price": price, "change": 0, "change_percent": 0}
            return {"price": 15000.0, "change": 0, "change_percent": 0}
        except Exception as e:
            print(f"❌ 取得期貨價格失敗: {e}")
            return {"price": 15000.0, "change": 0, "change_percent": 0}
    
    def get_volatility(self) -> float:
        return 20.0

    def get_quote(self, symbol: str) -> Dict:
        """
        Get real-time quote for a specific symbol.
        Returns: {
            'lastPrice': float, 
            'bid': float, 
            'ask': float, 
            'volume': int, 
            'change': float, 
            'changePercent': float,
            'time': str
        }
        """
        if not self.is_logged_in:
            return {}
            
        try:
            quote = self._get_quote_safe(symbol)
            if not quote:
                return {}
                
            result = {
                'lastPrice': float(quote.get('lastPrice', 0)),
                'volume': int(quote.get('totalVolume', 0)),
                'change': float(quote.get('change', 0)),
                'changePercent': float(quote.get('changePercent', 0)),
                'time': quote.get('lastTime', '')
            }
            
            # Extract Bid/Ask (Best Bid/Ask)
            # Note: Fubon API structure might vary, usually it's in 'lastTrade' or separate fields
            # Based on previous code:
            # bid = float(quote['lastTrade'].get('bid', 0))
            # ask = float(quote['lastTrade'].get('ask', 0))
            # But let's check if 'bidPrice' / 'askPrice' exist at top level or inside
            
            # Try top level first (some APIs)
            if 'bidPrice' in quote:
                result['bid'] = float(quote['bidPrice'][0] if isinstance(quote['bidPrice'], list) else quote['bidPrice'])
            elif 'bids' in quote and quote['bids']:
                 result['bid'] = float(quote['bids'][0].get('price', 0))
            
            if 'askPrice' in quote:
                result['ask'] = float(quote['askPrice'][0] if isinstance(quote['askPrice'], list) else quote['askPrice'])
            elif 'asks' in quote and quote['asks']:
                 result['ask'] = float(quote['asks'][0].get('price', 0))

            # Fallback to 0 if not found
            if 'bid' not in result: result['bid'] = 0.0
            if 'ask' not in result: result['ask'] = 0.0
            
            return result
        except Exception as e:
            print(f"❌ get_quote failed for {symbol}: {e}")
            return {}

    def get_option_price(self, strike: int, option_type: str) -> float:
        if not self.is_logged_in:
            return 50.0
        try:
            month, year = self._get_contract_month_year()
            year_digit = str(year)[-1]
            
            if option_type.lower() == 'call':
                month_codes = "ABCDEFGHIJKL"
            else:
                month_codes = "MNOPQRSTUVWX"
            month_code = month_codes[month - 1]
            option_symbol = f"TXO{strike}{month_code}{year_digit}"
            
            quote = self.api.marketdata.rest_client.futopt.intraday.quote(symbol=option_symbol)
            if quote and 'lastPrice' in quote and quote['lastPrice'] > 0:
                return float(quote['lastPrice'])
            elif quote and 'referencePrice' in quote:
                return float(quote.get('referencePrice', 50))
            return 50.0
        except Exception as e:
            print(f"❌ 取得選擇權價格失敗: {e}")
            return 50.0

    def get_stock_price(self, symbol: str) -> float:
        """Get real-time stock price (e.g. 00631L)."""
        if not self.is_logged_in:
            return 0.0
        try:
            # Try to use stock client if available
            if hasattr(self.api.marketdata.rest_client, 'stock'):
                quote = self.api.marketdata.rest_client.stock.intraday.quote(symbol=symbol)
                if quote and 'lastPrice' in quote and quote['lastPrice'] > 0:
                    return float(quote['lastPrice'])
            
            # Fallback to generic quote if stock client not found or fails
            return self.get_price_by_symbol(symbol)
        except Exception as e:
            print(f"❌ 取得股票價格失敗 ({symbol}): {e}")
            return 0.0

    def get_kline_data(self, symbol: str, period: str = "1mo") -> pd.DataFrame:
        """Get historical K-line data using direct Yahoo API (bypassing yfinance rate limits)."""
        try:
            # Map period to range if needed (usually same)
            # yfinance periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
            range_param = period
            
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={range_param}&interval=1d"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            
            # print(f"Fetching {url}...")
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "chart" in data and "result" in data["chart"] and data["chart"]["result"]:
                    result = data["chart"]["result"][0]
                    timestamps = result.get("timestamp", [])
                    indicators = result.get("indicators", {})
                    quote = indicators.get("quote", [{}])[0]
                    
                    if not timestamps or not quote:
                        return pd.DataFrame()
                        
                    closes = quote.get("close", [])
                    opens = quote.get("open", [])
                    highs = quote.get("high", [])
                    lows = quote.get("low", [])
                    volumes = quote.get("volume", [])
                    
                    # Create DataFrame
                    df = pd.DataFrame({
                        "Date": [datetime.fromtimestamp(ts) for ts in timestamps],
                        "Open": opens,
                        "High": highs,
                        "Low": lows,
                        "Close": closes,
                        "Volume": volumes
                    })
                    
                    # Set Date as index to match yfinance format
                    df.set_index("Date", inplace=True)
                    
                    # Drop rows with missing data (e.g. future dates or errors)
                    df.dropna(inplace=True)
                    
                    return df
                else:
                    print(f"⚠️ Yahoo API returned invalid JSON for {symbol}")
            else:
                print(f"⚠️ Yahoo API failed for {symbol}: {response.status_code}")
                
        except Exception as e:
            print(f"❌ get_kline_data failed for {symbol}: {e}")
            
        # Fallback to yfinance if direct method fails (though likely also blocked)
        try:
            print(f"⚠️ Falling back to yfinance for {symbol}...")
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=period)
            if not df.empty:
                return df
        except Exception as e:
            print(f"❌ yfinance fallback failed: {e}")
            
        return pd.DataFrame()


    def place_order(self, strike: int, option_type: str, action: str, quantity: int, price: float, symbol: str = None, symbol2: str = None, action2: str = None, safe_check: bool = True, force: bool = False) -> Dict:
        if not self.is_logged_in:
            return {"success": False, "message": "未登入"}
        
        # --- Safety Checks ---
        if safe_check and not force:
            # 1. Trading Hours Check
            from datetime import datetime, time as dt_time
            now_time = datetime.now().time()
            is_regular = dt_time(8, 45) <= now_time <= dt_time(13, 45)
            is_night = now_time >= dt_time(15, 0) or now_time <= dt_time(5, 0)
            
            if not (is_regular or is_night):
                return {"success": False, "message": f"非交易時間 ({now_time.strftime('%H:%M')})，已阻擋下單。"}

            # 2. Price Deviation Check (Fat Finger)
            # Only check if we have a valid symbol to check against
            check_symbol = symbol
            if not check_symbol:
                # Infer symbol if not provided (same logic as below)
                try:
                    month, year = self._get_contract_month_year()
                    year_digit = str(year)[-1]
                    if option_type == 'Small TX':
                        month_codes = "ABCDEFGHIJKL"
                        month_code = month_codes[month - 1]
                        check_symbol = f"MXF{month_code}{year_digit}"
                    elif option_type == 'TX':
                        month_codes = "ABCDEFGHIJKL"
                        month_code = month_codes[month - 1]
                        check_symbol = f"TXF{month_code}{year_digit}"
                    else:
                        if option_type.lower() == 'call':
                            month_codes = "ABCDEFGHIJKL"
                        else:
                            month_codes = "MNOPQRSTUVWX"
                        month_code = month_codes[month - 1]
                        check_symbol = f"TXO{strike}{month_code}{year_digit}"
                except:
                    pass # Skip check if symbol inference fails
            
            if check_symbol:
                market_price = self.get_price_by_symbol(check_symbol)
                if market_price > 0:
                    deviation = abs(price - market_price) / market_price
                    if deviation > 0.02: # 2% threshold
                        return {
                            "success": False, 
                            "message": f"價格異常警示！委託價 {price} 與市價 {market_price} 偏差 {deviation*100:.1f}% (>2%)。請檢查是否輸入錯誤。"
                        }
                else:
                    # If market price is 0 or failed to fetch, maybe warn?
                    # For now, we let it pass but maybe log it.
                    print(f"⚠️ 無法取得市價 ({check_symbol})，跳過價格檢查")
        try:
            from fubon_neo.sdk import FutOptOrder
            from fubon_neo.constant import BSAction, FutOptOrderType, FutOptMarketType, FutOptPriceType, TimeInForce
            
            futopt_account = None
            if hasattr(self, 'accounts') and self.accounts:
                for acc in self.accounts:
                    if acc.account_type == "futopt":
                        futopt_account = acc
                        break
            
            if not futopt_account:
                return {"success": False, "message": "找不到期貨帳號"}

            # Determine symbol and market type
            market_type = FutOptMarketType.Option
            
            if symbol:
                option_symbol = symbol
                if symbol.startswith("MXF") or symbol.startswith("TXF"):
                    market_type = FutOptMarketType.Future
                else:
                    market_type = FutOptMarketType.Option
            else:
                month, year = self._get_contract_month_year()
                year_digit = str(year)[-1]
                
                if option_type == 'Small TX':
                    market_type = FutOptMarketType.Future
                    month_codes = "ABCDEFGHIJKL"
                    month_code = month_codes[month - 1]
                    option_symbol = f"MXF{month_code}{year_digit}"
                elif option_type == 'TX':
                    market_type = FutOptMarketType.Future
                    month_codes = "ABCDEFGHIJKL"
                    month_code = month_codes[month - 1]
                    option_symbol = f"TXF{month_code}{year_digit}"
                else:
                    # Options
                    market_type = FutOptMarketType.Option
                    if option_type.lower() == 'call':
                        month_codes = "ABCDEFGHIJKL"
                    else:
                        month_codes = "MNOPQRSTUVWX"
                    month_code = month_codes[month - 1]
                    option_symbol = f"TXO{strike}{month_code}{year_digit}"
            
            print(f"📡 正在下單: {action} {quantity}口 {option_symbol} @ {price} (Type: {market_type})")
            if symbol2:
                print(f"   Leg 2: {action2} {symbol2}")
            
            # Prepare Order Object
            order_args = {
                "buy_sell": BSAction.Sell if action == "Sell" else BSAction.Buy,
                "symbol": option_symbol,
                "price": str(price),
                "lot": quantity,
                "order_type": FutOptOrderType.New,
                "market_type": market_type,
                "price_type": FutOptPriceType.Limit,
                "time_in_force": TimeInForce.ROD
            }
            
            # Add Leg 2 if present
            if symbol2 and action2:
                order_args["symbol2"] = symbol2
                order_args["buy_sell2"] = BSAction.Sell if action2 == "Sell" else BSAction.Buy
            
            order = FutOptOrder(**order_args)
            
            result = self.api.futopt.place_order(futopt_account, order)
            
            if result and result.is_success:
                # Try to extract order number or sequence number
                order_no = ""
                if hasattr(result.data, 'order_no') and result.data.order_no and result.data.order_no.strip():
                    order_no = result.data.order_no
                elif hasattr(result.data, 'seq_no') and result.data.seq_no and result.data.seq_no.strip():
                    order_no = result.data.seq_no
                else:
                    order_no = str(result.data) # Fallback to full string if nothing found
                
                print(f"✅ 下單成功！委託單號: {order_no}")
                return {
                    "success": True,
                    "order_no": order_no,
                    "message": f"下單成功 - {action} {quantity}口 {option_symbol}" + (f" & {action2} {symbol2}" if symbol2 else ""),
                    "symbol": option_symbol
                }
            else:
                error_msg = result.message if result else "未知錯誤"
                print(f"❌ 下單失敗: {error_msg}")
                return {"success": False, "message": f"下單失敗: {error_msg}"}
        except Exception as e:
            print(f"❌ 下單錯誤: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "message": str(e)}

    def get_positions(self) -> list:
        if not self.is_logged_in:
            print("❌ get_positions: Not logged in")
            return []
        try:
            result = []
            if hasattr(self, 'accounts') and self.accounts:
                for acc in self.accounts:
                    if acc.account_type == "futopt":
                        res = self.api.futopt_accounting.query_hybrid_position(acc)
                        if res and res.is_success and res.data:
                            for pos in res.data:
                                # Determine Buy/Sell
                                buy_sell = str(pos.buy_sell)
                                is_buy = "Buy" in buy_sell or "B" == buy_sell
                                
                                # Quantity (Tradable Lot)
                                qty = int(pos.tradable_lot)
                                if not is_buy:
                                    qty = -qty
                                
                                result.append({
                                    "account": acc.account,
                                    "symbol": pos.symbol,
                                    "quantity": qty,
                                    "avg_price": float(pos.price) if pos.price else 0.0,
                                    "current_price": float(pos.market_price) if pos.market_price else 0.0,
                                    "pnl": float(pos.profit_or_loss) if pos.profit_or_loss else 0.0,
                                    "action": "多單" if is_buy else "空單"
                                })
            return result
        except Exception as e:
            print(f"❌ 查詢庫存失敗: {e}")
            return []

    def get_equity(self) -> dict:
        """Fetch margin equity info."""
        if not self.is_logged_in:
            return {}
            
        # Bypass for Test Environment to avoid Rust Panic
        if self.api_url and "test" in self.api_url.lower():
            return {
                "equity": 1000000.0,
                "available_margin": 800000.0,
                "pnl": 0.0,
                "risk_index": 0.0
            }

        try:
            if hasattr(self, 'accounts') and self.accounts:
                for acc in self.accounts:
                    if acc.account_type == "futopt":
                        res = self.api.futopt_accounting.query_margin_equity(acc)
                        if res and res.is_success and res.data:
                            # Handle list response
                            data = res.data[0] if isinstance(res.data, list) else res.data
                            return {
                                "equity": float(data.today_equity),
                                "available_margin": float(data.available_margin),
                                "pnl": float(data.fut_unrealized_pnl) + float(data.opt_pnl),
                                "risk_index": float(data.risk_index)
                            }
            return {}
        except Exception as e:
            print(f"❌ 查詢權益數失敗: {e}")
            return {}

    def get_orders(self) -> list:
        if not self.is_logged_in:
            return []
        try:
            result = []
            if hasattr(self, 'accounts') and self.accounts:
                for acc in self.accounts:
                    if acc.account_type == "futopt":
                        orders_result = self.api.futopt.get_order_results(acc)
                        
                        if orders_result and orders_result.is_success and orders_result.data:
                            for order in orders_result.data:
                                status = str(order.status)
                                result.append({
                                    "account": acc.account, # Add account info
                                    "order_no": order.order_no,
                                    "symbol": order.symbol,
                                    "action": "Buy" if order.buy_sell == 1 else "Sell",
                                    "price": order.price,
                                    "quantity": order.lot,
                                    "filled_qty": order.filled_lot if hasattr(order, 'filled_lot') else 0,
                                    "status": status,
                                    "time": order.order_time if hasattr(order, 'order_time') else ""
                                })
            
            # Sort by time desc
            result.sort(key=lambda x: x['time'], reverse=True)
            return result
        except Exception as e:
            print(f"❌ 查詢委託失敗: {e}")
            return []

    def get_account_balance(self) -> Dict:
        if not self.is_logged_in:
            return {}
        try:
            account = self.api.get_account()
            return {
                "available_balance": account.available_balance,
                "buying_power": account.buying_power,
                "margin_used": account.margin_used,
                "total_value": account.total_value
            }
        except Exception as e:
            print(f"❌ 查詢帳戶資訊失敗: {e}")
            return {}
