import threading
import time
import requests
from datetime import datetime
import config
from strategy_service import calculate_strategy_state

def send_telegram_message(msg, token, chat_id):
    """Send message to Telegram Bot"""
    if not token or not chat_id:
        return False, "Missing token or chat_id"
    try:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": msg
        }
        response = requests.post(url, json=payload, timeout=5)
        if response.status_code == 200:
            return True, "Success"
        else:
            return False, f"API Error {response.status_code}: {response.text}"
    except Exception as e:
        print(f"Telegram Notify Error: {e}")
        return False, str(e)

class AutoTrader:
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(AutoTrader, cls).__new__(cls)
                cls._instance.enabled = False
                cls._instance.last_run_date = None
                cls._instance.provider = None
                cls._instance.params = {}
                cls._instance.log_callback = None
                cls._instance.thread_started = False
                cls._instance.start_worker()
        return cls._instance
    
    def start_worker(self):
        if not self.thread_started:
            t = threading.Thread(target=self._worker, daemon=True, name="AutoTraderThread")
            t.start()
            self.thread_started = True
        
    def _worker(self):
        while True:
            try:
                if self.enabled and self.provider:
                    now = datetime.now()
                    # Check time: 13:30 (and within the first minute)
                    # NOTE: This hardcoded check might conflict with configurable time in app.py
                    # If app.py handles the execution via inline logic, we might want to disable this 
                    # OR make this thread just a backup.
                    # Given the user wants configurable time, this background thread is problematic
                    # if it uses hardcoded 13:30.
                    # Let's DISABLE the hardcoded check here and rely on app.py's inline logic 
                    # OR update this to use a configurable time passed in params.
                    
                    # For now, to stop the spam, we rely on the singleton pattern.
                    # But we should also respect the configurable time.
                    
                    # If we want the background thread to handle it, we need to pass the time to it.
                    # But app.py has the time input.
                    
                    # Let's make this thread mostly passive or use the params.
                    target_time = self.params.get('auto_trade_time') # We need to pass this
                    
                    if target_time:
                        if now.hour == target_time.hour and now.minute == target_time.minute:
                            if self.last_run_date != now.strftime("%Y-%m-%d"):
                                self.execute_trade()
                                self.last_run_date = now.strftime("%Y-%m-%d")
                    
            except Exception as e:
                print(f"AutoTrader Error: {e}")
            
            time.sleep(10) # Check every 10 seconds
            
    def execute_trade(self):
        tg_token = config.TELEGRAM_BOT_TOKEN
        tg_chat_id = config.TELEGRAM_CHAT_ID
        
        if self.log_callback:
            self.log_callback({
                'type': 'CHECK',
                'function': 'Auto Check',
                'message': '⏰ 自動下單觸發! (Auto-Trade Triggered)',
                'symbol': 'N/A',
                'action': 'Check',
                'price': 0,
                'quantity': 0,
                'simple_status': 'Success'
            })
            
        send_telegram_message("\n⏰ 自動下單檢查觸發!", tg_token, tg_chat_id)
            
        # 1. Fetch Data
        try:
            # Note: This runs in a background thread, so we need to be careful with API calls
            # Assuming provider is thread-safe or we are lucky
            # tx_quote = self.provider.get_quote("TXF") # Assuming symbol is known or passed
            
            # Use params which are updated by main thread
            ma_value = self.params.get('ma_value', 0)
            etf_qty = self.params.get('etf_qty', 0)
            etf_price = self.params.get('etf_price', 0)
            current_mxf_qty = self.params.get('current_mxf_qty', 0)
            current_index = self.params.get('current_index', 0)
            
            if current_index > 0 and ma_value > 0:
                result = calculate_strategy_state(
                    current_index, 
                    ma_value, 
                    etf_qty, 
                    etf_price, 
                    current_mxf_qty, 
                    self.params
                )
                
                action = result['action_needed']
                qty_diff = result['qty_diff']
                
                if self.log_callback:
                    self.log_callback({
                        'type': 'CHECK',
                        'function': 'Strategy Calc',
                        'message': f"試算結果: {action} {abs(qty_diff)} 口",
                        'symbol': 'N/A',
                        'action': action,
                        'price': current_index,
                        'quantity': abs(qty_diff),
                        'simple_status': 'Success'
                    })
                
                send_telegram_message(f"\n📊 試算結果: {action} {abs(qty_diff)} 口\nIndex: {current_index}\nMA: {ma_value}", tg_token, tg_chat_id)
                
                # Risk Check
                min_risk = self.params.get('min_risk_level', 300.0)
                manual_equity = self.params.get('manual_equity', 0)
                margin_per_contract = self.params.get('margin_per_contract', 12250)
                
                current_risk = 0
                risk_source = "N/A"
                
                # 1. Try API
                try:
                    eq_info = self.provider.get_equity()
                    if eq_info and eq_info.get('risk_index', 0) > 0:
                        current_risk = eq_info.get('risk_index', 0)
                        risk_source = "API"
                except:
                    pass
                
                # 2. Fallback to Manual
                if current_risk == 0:
                    total_margin_req = abs(current_mxf_qty) * margin_per_contract
                    if total_margin_req > 0:
                        current_risk = (manual_equity / total_margin_req) * 100
                        risk_source = "Manual"
                    elif manual_equity > 0:
                        current_risk = 9999 # Safe
                        risk_source = "Manual (No Pos)"
                
                if current_risk > 0 and current_risk < min_risk:
                    msg = f"⚠️ 風險指標過低 ({current_risk:.2f}% {risk_source}) < 設定值 ({min_risk}%)，暫停下單！"
                    if self.log_callback: 
                         self.log_callback({
                            'type': 'CHECK',
                            'function': 'Risk Check',
                            'message': msg,
                            'symbol': 'N/A',
                            'action': 'Stop',
                            'price': 0,
                            'quantity': 0,
                            'simple_status': 'Failed'
                        })
                    send_telegram_message(f"\n{msg}", tg_token, tg_chat_id)
                    return # Stop execution
                
                if action == "Short" and qty_diff > 0:
                    # Place Short Order
                    order_id = self.provider.place_order("MXF", "Sell", qty_diff) # Simplified
                    if self.log_callback: 
                        self.log_callback({
                            'type': 'ORDER',
                            'function': 'Auto Order',
                            'message': f"下單賣出: {qty_diff} 口",
                            'symbol': 'MXF',
                            'action': 'Sell',
                            'price': current_index,
                            'quantity': qty_diff,
                            'simple_status': 'Success'
                        })
                    send_telegram_message(f"\n🔴 下單賣出 (Short): {qty_diff} 口", tg_token, tg_chat_id)
                    
                elif action == "Cover" and qty_diff < 0:
                    # Place Buy Order (Cover)
                    order_id = self.provider.place_order("MXF", "Buy", abs(qty_diff)) # Simplified
                    if self.log_callback: 
                        self.log_callback({
                            'type': 'ORDER',
                            'function': 'Auto Order',
                            'message': f"下單回補: {abs(qty_diff)} 口",
                            'symbol': 'MXF',
                            'action': 'Buy',
                            'price': current_index,
                            'quantity': abs(qty_diff),
                            'simple_status': 'Success'
                        })
                    send_telegram_message(f"\n🟢 下單回補 (Cover): {abs(qty_diff)} 口", tg_token, tg_chat_id)
                else:
                    if self.log_callback: 
                        self.log_callback({
                            'type': 'CHECK',
                            'function': 'Auto Check',
                            'message': '無需動作 (No Action Needed)',
                            'symbol': 'N/A',
                            'action': 'Hold',
                            'price': current_index,
                            'quantity': 0,
                            'simple_status': 'Success'
                        })
                    send_telegram_message("\n⚪ 無需動作 (No Action Needed)", tg_token, tg_chat_id)
                    
        except Exception as e:
            if self.log_callback:
                self.log_callback({
                    'type': 'CHECK',
                    'function': 'Auto Check',
                    'message': f"自動下單失敗: {str(e)}",
                    'symbol': 'N/A',
                    'action': 'Error',
                    'price': 0,
                    'quantity': 0,
                    'simple_status': 'Failed'
                })
