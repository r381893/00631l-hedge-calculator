import streamlit as st
from streamlit_autorefresh import st_autorefresh
import time
import math
import os
import pandas as pd
import pandas as pd
import requests
from datetime import datetime, timedelta
import plotly.graph_objects as go
import threading
from data_provider import FubonDataProvider, MockDataProvider
import config
from firestore_db import FirestoreDB
from broker_service import MockBroker, FubonBrokerAdapter
from strategy_service import calculate_strategy_state


import threading

from scheduler import AutoTrader, send_telegram_message
from mean_reversion_service import MeanReversionStrategy

# Page Config
# Page Config
st.set_page_config(
    page_title="0050正二 (00631L) 避險監控",
    page_icon="🛡️",
    layout="wide"
)

# Debug: Verify App Start
# st.write("Debug: App is starting...")

# Custom CSS
st.markdown("""
<style>
    .big-metric {
        font-size: 2rem;
        font-weight: bold;
        color: #1f77b4;
    }
    /* Environment Badges */
    .env-badge-test {
        background-color: #28a745;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.8em;
        font-weight: bold;
    }
    .env-badge-prod {
        background-color: #dc3545;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.8em;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)

# Title
st.title("🛡️ 0050正二 (00631L) 避險監控")
st.markdown("---")

# Initialize session state
if 'provider' not in st.session_state:
    st.session_state.provider = None
if 'broker' not in st.session_state:
    st.session_state.broker = None
if 'mock_broker' not in st.session_state:
    st.session_state.mock_broker = MockBroker() # Persist mock broker across reruns
if 'db' not in st.session_state:
    st.session_state.db = FirestoreDB()

if 'tv_monitoring' not in st.session_state:
    st.session_state.tv_monitoring = False

if 'mr_positions' not in st.session_state:
    st.session_state.mr_positions = [] # List of {price, qty, time}
if 'mr_logs' not in st.session_state:
    st.session_state.mr_logs = []


# Check for stale provider instance
if st.session_state.provider and not hasattr(st.session_state.provider, 'get_orders'):
    st.warning("系統更新，請重新連接 API")
    st.session_state.provider = None

# Sidebar - Settings
with st.sidebar:
    st.header("⚙️ 系統設定")
    
    # Auto Refresh Settings
    st.subheader("🔄 自動更新 (Auto Refresh)")
    # Default to False to debug
    refresh_enabled = st.checkbox("啟用自動更新", value=False, key="auto_refresh")
    refresh_interval = st.number_input("更新頻率 (秒)", min_value=1, value=3, step=1)
    
    if refresh_enabled:
        count = st_autorefresh(interval=refresh_interval * 1000, key="fubon_refresh")
        st.caption(f"已更新 {count} 次")
    
    # Chart Theme - Removed
    # chart_theme = st.radio("圖表主題 (Chart Theme)", ["Dark", "Light"], index=0, horizontal=True)
    # template_name = "plotly_dark" if chart_theme == "Dark" else "plotly_white"
    template_name = "plotly_dark" # Default to Dark
    
    # Environment Selector
    st.subheader("1️⃣ API 連接")
    
    # Environment Visual Indicator
    env_mode = st.radio("環境選擇 (Environment)", ["測試環境 (Test)", "正式環境 (Production)"], index=0)
    
    if "Test" in env_mode:
        st.markdown('<div style="border-left: 5px solid #28a745; padding-left: 10px;">🟢 <b>目前為測試環境 (Test Mode)</b></div>', unsafe_allow_html=True)
        current_env_code = "TEST"
        api_url = config.FUBON_TEST_API_URL
        default_user_id = config.FUBON_TEST_USER_ID
        default_password = config.FUBON_TEST_PASSWORD
        default_cert_path = config.FUBON_TEST_CERT_PATH
        default_cert_password = config.FUBON_TEST_CERT_PASSWORD
    else:
        st.markdown('<div style="border-left: 5px solid #dc3545; padding-left: 10px;">🔴 <b>目前為正式環境 (Production Mode)</b></div>', unsafe_allow_html=True)
        st.error("⚠️ 注意：您正在正式環境進行操作！")
        current_env_code = "PROD"
        api_url = config.FUBON_PRODUCTION_API_URL
        default_user_id = config.FUBON_PRODUCTION_USER_ID
        default_password = config.FUBON_PRODUCTION_PASSWORD
        default_cert_path = config.FUBON_PRODUCTION_CERT_PATH
        default_cert_password = config.FUBON_PRODUCTION_CERT_PASSWORD
        
    default_tg_token = config.TELEGRAM_BOT_TOKEN
    default_tg_chat_id = config.TELEGRAM_CHAT_ID
    
    # Auto-Trade Settings
    st.subheader("🤖 自動下單 (Auto-Trade)")
    auto_trade_enabled = st.checkbox("啟用每日自動下單", value=False, key="auto_trade_enabled")
    
    # Configurable Time
    default_time = datetime.strptime("13:30", "%H:%M").time()
    auto_trade_time = st.time_input("設定檢查時間", value=default_time)
    
    # Initialize/Update AutoTrader
    auto_trader = AutoTrader()
    auto_trader.enabled = auto_trade_enabled
    
    if auto_trade_enabled:
        st.caption(f"✅ 已啟用: 每日 {auto_trade_time.strftime('%H:%M')} 自動檢查並下單")
        if auto_trader.last_run_date:
            st.caption(f"上次執行: {auto_trader.last_run_date}")
            
        # Check if it's time to run
        now = datetime.now()
        
        # Manual Trigger for Testing
        if st.button("⚡ 強制執行自動下單 (測試用)", help="忽略時間限制，立即執行一次策略檢查"):
            st.toast("🚀 強制啟動自動下單程序...")
            auto_trader.execute_trade()
        
        # We need to ensure we have data to calculate strategy
        # Strategy calculation happens in Tab 1 logic usually.
        # We need to access the latest strategy result.
        # Let's look for `calculate_strategy_state` usage later in the file.
        pass
    else:
        st.caption("⏹️ 已停用")

    
    # Auto-detect OS and set default path if empty
    current_os = config.get_current_os()
    if not default_cert_path:
        default_cert_path = config.get_default_cert_path()
        
    st.caption(f"💻 偵測系統: {current_os}")
    
    # Initialize Order Log
    if 'order_log' not in st.session_state:
        st.session_state.order_log = []
        
    # Initialize No Action Log for Table
    if 'no_action_logs' not in st.session_state:
        st.session_state.no_action_logs = []

    def handle_order_update(info):
        """Callback for real-time updates"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        info['timestamp'] = timestamp
        st.session_state.order_log.insert(0, info)
        
        # Show toast for important events
        if info['type'] == 'FILL':
            st.toast(f"💰 成交! {info['symbol']} {info['quantity']}口 @ {info['price']}", icon="🎉")
        elif info['type'] == 'ORDER' and info['simple_status'] == 'Failed':
            st.toast(f"❌ 下單失敗: {info['message']}", icon="⚠️")
        elif info['type'] == 'ORDER' and info['simple_status'] == 'Success':
            st.toast(f"✅ {info['function']} 成功", icon="👍")
        elif info['type'] == 'CHECK':
            st.toast(f"🔍 {info['message']}", icon="📋")
            
        # Send Telegram Notify
        if config.TELEGRAM_BOT_TOKEN and config.TELEGRAM_CHAT_ID:
            msg = ""
            if info['type'] == 'FILL':
                msg = f"\n💰 成交回報\n{info['symbol']} {info['action']} {info['quantity']}口 @ {info['price']}"
            elif info['type'] == 'ORDER' and info['simple_status'] == 'Failed':
                msg = f"\n❌ 下單失敗\n{info['message']}"
            elif info['type'] == 'CHECK':
                # Optional: Notify for check? Maybe just for errors or specific status?
                # User asked for log, maybe not telegram for every check if successful?
                # But existing code sent telegram for "No Action".
                pass 
            
            if msg:
                send_telegram_message(msg, config.TELEGRAM_BOT_TOKEN, config.TELEGRAM_CHAT_ID)
    
    # Wire callback for AutoTrader
    auto_trader.log_callback = handle_order_update

    # Credential Inputs
    with st.expander("🔑 憑證與帳號設定", expanded=True):
        input_user_id = st.text_input("身分證字號 (User ID)", value=default_user_id, key=f"user_id_{current_env_code}")
        input_password = st.text_input("登入密碼 (Password)", value=default_password, type="password", key=f"password_{current_env_code}")
        input_cert_path = st.text_input("憑證路徑 (Cert Path)", value=default_cert_path, key=f"cert_path_{current_env_code}")
        input_cert_password = st.text_input("憑證密碼 (Cert Password)", value=default_cert_password, type="password", key=f"cert_password_{current_env_code}")
        
        st.markdown("---")
        st.caption("📱 Telegram 通知設定")
        input_tg_token = st.text_input("Telegram Bot Token", value=default_tg_token, type="password", help="向 @BotFather 申請")
        input_tg_chat_id = st.text_input("Telegram Chat ID", value=default_tg_chat_id, help="向 @userinfobot 查詢")
        
        if st.button("🔔 測試通知 (Test Notify)"):
            if not input_tg_token or not input_tg_chat_id:
                st.error("請先輸入 Token 和 Chat ID")
            else:
                success, msg = send_telegram_message("🔔 這是一則測試訊息！\nTelegram 通知功能正常運作中。", input_tg_token, input_tg_chat_id)
                if success:
                    st.success("已發送測試訊息，請檢查您的 Telegram")
                else:
                    st.error(f"發送失敗: {msg}")
        
        # Active Reporting (Always Enabled)
        enable_active_reporting = True

        # Save Settings Button
        # Save Settings Button
        if st.button(f"💾 儲存設定 ({current_env_code})"):
            if not input_user_id or not input_password:
                st.error("請輸入帳號密碼後再儲存")
            else:
                success, msg = config.save_settings_to_env(
                    input_user_id, 
                    input_password, 
                    input_cert_path, 
                    input_cert_password,
                    input_tg_token,
                    input_tg_chat_id,
                    env_mode=current_env_code
                )
                if success:
                    st.success(msg)
                    # Update config in memory so it persists without reload
                    if current_env_code == "TEST":
                        config.FUBON_TEST_USER_ID = input_user_id
                        config.FUBON_TEST_PASSWORD = input_password
                        config.FUBON_TEST_CERT_PATH = input_cert_path
                        config.FUBON_TEST_CERT_PASSWORD = input_cert_password
                    else:
                        config.FUBON_PRODUCTION_USER_ID = input_user_id
                        config.FUBON_PRODUCTION_PASSWORD = input_password
                        config.FUBON_PRODUCTION_CERT_PATH = input_cert_path
                        config.FUBON_PRODUCTION_CERT_PASSWORD = input_cert_password
                    
                    config.TELEGRAM_BOT_TOKEN = input_tg_token
                    config.TELEGRAM_CHAT_ID = input_tg_chat_id
                else:
                    st.error(msg)



    if st.button("🔌 連接富邦 API", use_container_width=True, type="primary"):
        with st.spinner("正在連接..."):
            try:
                # Real/Test Environment
                provider = FubonDataProvider(
                    user_id=input_user_id.strip(),
                    password=input_password.strip(),
                    cert_path=input_cert_path.strip(),
                    cert_password=input_cert_password.strip(),
                    api_url=api_url
                )
                if provider.is_logged_in:
                    st.session_state.provider = provider
                    st.session_state.broker = FubonBrokerAdapter(provider)
                    
                    # Register Callbacks based on toggle
                    if enable_active_reporting:
                        provider.set_callbacks(on_order=handle_order_update, on_fill=handle_order_update)
                    else:
                        provider.set_callbacks(on_order=None, on_fill=None)
                    st.success(f"✅ API 連接成功！({env_mode})")
                else:
                    st.error(f"❌ 連接失敗：{provider.login_error_message}")
            except BaseException as e:
                st.error(f"❌ 發生嚴重錯誤 (Crash): {e}")
                print(f"❌ App Crash during login: {e}")
    
    # Update callbacks if toggle changes while connected
    if st.session_state.provider and st.session_state.provider.is_logged_in:
        # We can re-register callbacks on every rerun to ensure they match the checkbox
        # This is safe because set_callbacks just updates internal references
        if enable_active_reporting:
            st.session_state.provider.set_callbacks(on_order=handle_order_update, on_fill=handle_order_update)
        else:
            st.session_state.provider.set_callbacks(on_order=None, on_fill=None)

    # Display Order Log in Sidebar
    if st.session_state.order_log and enable_active_reporting:
        with st.expander("📝 即時回報紀錄", expanded=False):
            for log in st.session_state.order_log[:10]: # Show last 10
                icon = "💰" if log['type'] == 'FILL' else ("✅" if log.get('simple_status') == 'Success' else "⏳")
                if log.get('simple_status') == 'Failed': icon = "❌"
                if log['type'] == 'CHECK': icon = "📋"
                
                st.markdown(f"**{log['timestamp']} {icon} {log.get('function', '成交')}**")
                if log['type'] == 'ORDER':
                    st.caption(f"{log['symbol']} {log['action']} {log['price']} | {log['message']}")
                elif log['type'] == 'CHECK':
                    st.caption(f"{log['message']}")
                else:
                    st.caption(f"{log['symbol']} {log['action']} {log['quantity']} @ {log['price']}")
                st.divider()
    
    if st.session_state.provider and st.session_state.provider.is_logged_in:
        st.success("🟢 API 已連接")
    else:
        st.warning("🔴 未連接")
    
    st.markdown("---")
    



# Main Area
if not st.session_state.provider or not st.session_state.provider.is_logged_in:
    st.info("👈 請先在側邊欄連接富邦 API")
    st.stop()

provider = st.session_state.provider

# Get Real-time Data
tx_data = provider.get_tx_price()
if isinstance(tx_data, dict):
    tx_price = tx_data.get('price', 15000.0)
    tx_change = tx_data.get('change', 0)
    tx_change_percent = tx_data.get('change_percent', 0)
else:
    tx_price = tx_data
    tx_change = 0
    tx_change_percent = 0

atm_strike = round(tx_price / 100) * 100

# Navigation
# Main View
# Navigation
# Main View
st.header("🛡️ 0050 避險監控")

tab3_name = "🧪 測試環境交易" if current_env_code == "TEST" else "💰 真實交易"
tab1, tab2, tab3, tab4 = st.tabs(["📊 監控面板", "📈 策略回測", tab3_name, "📉 均值回歸"])



with tab1:
    try:
        st.header("🛡️ 0050正二 (00631L) 避險監控")
        st.caption("策略：持有 00631L，當大盤跌破 13日線 (13MA) 時，使用微台 (MXF) 進行避險。")
        
        # --- Data Fetching (Moved Up for Estimates) ---
        # 1. 00631L Price
        etf_symbol = "00631L"
        etf_price = provider.get_stock_price(etf_symbol)
        
        # 2. Index & MA
        @st.cache_data(ttl=3600)
        def get_ma_data(period):
            df = provider.get_kline_data("^TWII", period="3mo")
            if not df.empty:
                df['MA'] = df['Close'].rolling(window=period).mean()
                return df
            return pd.DataFrame()

        # 3. Micro Tai (MXF) Price
        try:
            month_codes = "ABCDEFGHIJKL"
            now = datetime.now()
            m_code = month_codes[now.month - 1]
            y_digit = str(now.year)[-1]
            mxf_symbol = f"MXF{m_code}{y_digit}"
            mxf_price = provider.get_price_by_symbol(mxf_symbol)
            if mxf_price == 0:
                next_m = now.month + 1 if now.month < 12 else 1
                m_code_next = month_codes[next_m - 1]
                y_digit_next = str(now.year if now.month < 12 else now.year + 1)[-1]
                mxf_symbol = f"MXF{m_code_next}{y_digit_next}"
                mxf_price = provider.get_price_by_symbol(mxf_symbol)
        except:
            mxf_symbol = "MXF"
            mxf_symbol = "MXF"
            mxf_price = 0

        # --- Parameters ---
        # 1. Entry Settings
        with st.expander("📉 避險參數設定 (Entry Settings)", expanded=True):
            col1, col2, col3, col4 = st.columns(4)
            
            # Pre-fetch data for headers
            # We need ma_period from col1, but we can't get it before rendering col1.
            # So we render col1 first, get the value, then fetch data, then render others?
            # Streamlit execution is linear.
            
            with col1:
                st.markdown("#### 基本設定")
                total_shares = st.number_input("00631L 張數", min_value=1, value=7, step=1)
                ma_period = st.number_input("MA 週期 (日)", min_value=5, value=13, step=1)
                current_mxf_qty = st.number_input("目前微台避險口數", min_value=0, value=0, step=1)
                
                # Fetch MA Data immediately to use in other columns
                ma_df = get_ma_data(ma_period)
                ma_value = 0
                if not ma_df.empty:
                    ma_value = ma_df['MA'].iloc[-1]
                
                current_index = tx_price
            
            # Helper to calc distance string
            def get_dist_str(threshold_pct):
                if ma_value > 0:
                    trigger_price = ma_value * (1 - threshold_pct/100)
                    dist = current_index - trigger_price
                    # If current > trigger, we are above it (safe). Dist is positive.
                    # User wants "差 -XXX 點" (meaning how much to fall?)
                    # Or just "差 XXX 點"
                    # Usually "差 -150" means needs to fall 150.
                    # Let's show "再跌 XXX" or "已觸發"
                    if current_index < trigger_price:
                        return f"(✅ 已觸發)"
                    else:
                        return f"(差 -{dist:.0f} 點)"
                return ""

            with col2:
                # Default 0.5
                # We need to get the input value to calc distance, 
                # but we need distance to show in header (before input).
                # Circular? 
                # We can use st.session_state or just use a default for the header if not set?
                # Or render input first, then header? No, header is above.
                # We can use the value from previous run (st.session_state) if available.
                
                # Let's try to read the widget state directly if possible, or just render header after?
                # No, header must be top.
                with st.info("第一階避險 (Stage 1)"):
                    h_th_1_default = 0.5
                    h_th_1 = st.session_state.get('h_th_1', h_th_1_default)
                    dist_str_1 = get_dist_str(h_th_1)
                    
                    st.markdown(f"**門檻**: <span style='color:gray'>{dist_str_1}</span>", unsafe_allow_html=True)
                    hedge_threshold_1 = st.number_input("門檻 (%)", value=h_th_1_default, step=0.1, key='h_th_1')
                    hedge_ratio_1 = st.slider("比例", 0.0, 1.0, 0.33, step=0.05)
                
            with col3:
                with st.warning("第二階避險 (Stage 2)"):
                    h_th_2_default = 1.0
                    h_th_2 = st.session_state.get('h_th_2', h_th_2_default)
                    dist_str_2 = get_dist_str(h_th_2)
                    
                    st.markdown(f"**門檻**: <span style='color:gray'>{dist_str_2}</span>", unsafe_allow_html=True)
                    hedge_threshold_2 = st.number_input("門檻 (%)", value=h_th_2_default, step=0.1, key='h_th_2')
                    hedge_ratio_2 = st.slider("比例", 0.0, 1.0, 0.66, step=0.05)
                
            with col4:
                with st.error("第三階避險 (Stage 3)"):
                    h_th_3_default = 1.5
                    h_th_3 = st.session_state.get('h_th_3', h_th_3_default)
                    dist_str_3 = get_dist_str(h_th_3)
                    
                    st.markdown(f"**門檻**: <span style='color:gray'>{dist_str_3}</span>", unsafe_allow_html=True)
                    hedge_threshold_3 = st.number_input("門檻 (%)", value=h_th_3_default, step=0.1, key='h_th_3')
                    hedge_ratio_3 = st.slider("比例", 0.0, 1.0, 1.0, disabled=True, help="第三階強制全額避險")

            # --- Calculations (Moved Inside Expander) ---
            # Use etf_price fetched earlier (line 377)
            # etf_qty is total_shares (input)
            etf_qty = total_shares
            etf_market_value = etf_price * etf_qty * 1000
            exposure_value = etf_market_value * 2 # 2x Leveraged
            
            mxf_contract_value = tx_price * 10
            total_contracts_needed = 0
            if mxf_contract_value > 0:
                total_contracts_needed = int(round(exposure_value / mxf_contract_value))

            # Calculate Targets
            t1 = int(round(total_contracts_needed * hedge_ratio_1))
            t2 = int(round(total_contracts_needed * hedge_ratio_2))
            t3 = int(round(total_contracts_needed * hedge_ratio_3))
            diff2 = t2 - t1
            diff3 = t3 - t2
            
            st.divider()
            st.markdown("#### 🎯 避險目標 (Targets)")
            mc1, mc2, mc3 = st.columns(3)
            mc1.metric("第一階 (33%)", f"{t1} 口", "基本部位")
            mc2.metric("第二階 (66%)", f"{t2} 口", f"加碼 {diff2} 口")
            mc3.metric("第三階 (100%)", f"{t3} 口", f"加碼 {diff3} 口")

        # --- Calculations (Redundant block removed) ---
        # Variables are already calculated inside the expander above.
        # We keep them in local scope for later use (Strategy Logic).
        
        # 2. Exit Settings
        # 2. Exit Settings
        with st.expander("📈 反彈參數設定 (Exit Settings)", expanded=True):
            col_r1, col_r2, col_r3 = st.columns(3)
            
            # Stage 1 (Left)
            with col_r1:
                st.markdown("#### 第一階段 (Stage 1)")
                rebound_threshold_1 = st.number_input("第一階門檻 (%)", value=0.5, step=0.1, help="大盤 > 均線 + 此百分比時觸發 (負值代表均線下方)")
                cover_ratio_1 = st.slider("第一階回補比例", 0.0, 1.0, 0.33, step=0.05, key="cr1", help="回補「總避險口數」的百分之幾")
                
                est_cover_1 = 0
                est_remain_1 = total_contracts_needed
                if mxf_contract_value > 0:
                    est_cover_1 = int(round(total_contracts_needed * cover_ratio_1))
                    est_remain_1 = total_contracts_needed - est_cover_1
                    st.caption(f"回補: {est_cover_1} 口 | 剩餘: {est_remain_1} 口")

            # Stage 2 (Middle)
            with col_r2:
                st.markdown("#### 第二階段 (Stage 2)")
                rebound_threshold_2 = st.number_input("第二階門檻 (%)", value=1.0, step=0.1, help="大盤 > 均線 + 此百分比時觸發")
                cover_ratio_2 = st.slider("第二階回補比例", 0.0, 1.0, 0.50, step=0.05, key="cr2", help="回補「第一階剩餘口數」的百分之幾")
                
                est_cover_2 = 0
                est_remain_2 = est_remain_1
                if mxf_contract_value > 0:
                    est_cover_2 = int(round(est_remain_1 * cover_ratio_2))
                    est_remain_2 = est_remain_1 - est_cover_2
                    st.caption(f"回補: {est_cover_2} 口 | 剩餘: {est_remain_2} 口")

            # Stage 3 (Right)
            with col_r3:
                st.markdown("#### 第三階段 (Stage 3)")
                rebound_threshold_3 = st.number_input("第三階門檻 (%)", value=1.5, step=0.1, help="大盤 > 均線 + 此百分比時觸發")
                cover_ratio_3 = st.slider("第三階回補比例", 0.0, 1.0, 1.0, disabled=True, key="cr3", help="強制全數回補 (100%)")
                
                est_cover_3 = 0
                est_remain_3 = est_remain_2
                if mxf_contract_value > 0:
                    est_cover_3 = est_remain_2 # Always cover all remaining
                    est_remain_3 = 0
                    est_remain_3 = 0
                    st.caption(f"回補: {est_cover_3} 口 | 剩餘: {est_remain_3} 口 (全數回補)")

        # 3. Risk Management
        st.markdown("---")
        with st.container():
            with st.expander("🛡️ 風險控管 (Risk Management)", expanded=True):
                st.caption("當帳戶風險指標低於此數值時，將暫停自動下單以保護資金。")
                
                col_risk1, col_risk2 = st.columns(2)
                with col_risk1:
                    min_risk_level = st.number_input("最低風險指標限制 (%)", value=getattr(config, 'RISK_MIN_LEVEL', 300.0), step=10.0, help="預設 300%，低於此數值不執行新訂單")
                with col_risk2:
                    margin_per_contract = st.number_input("單口保證金 (TWD)", value=getattr(config, 'RISK_MARGIN_PER_CONTRACT', 12250.0), step=100.0, help="微台指參考保證金")
                    
                manual_equity = st.number_input("手動設定權益數 (Manual Equity)", value=getattr(config, 'RISK_MANUAL_EQUITY', 500000.0), step=10000.0, help="若 API 無法取得權益數，將使用此數值計算風險")
                
                # Save Button for Risk Settings
                if st.button("💾 儲存風險設定 (Save Risk Settings)"):
                    # Let's read current config values for credentials
                    c_uid = config.FUBON_TEST_USER_ID if current_env_code == "TEST" else config.FUBON_PRODUCTION_USER_ID
                    c_pwd = config.FUBON_TEST_PASSWORD if current_env_code == "TEST" else config.FUBON_PRODUCTION_PASSWORD
                    c_cert = config.FUBON_TEST_CERT_PATH if current_env_code == "TEST" else config.FUBON_PRODUCTION_CERT_PATH
                    c_cpwd = config.FUBON_TEST_CERT_PASSWORD if current_env_code == "TEST" else config.FUBON_PRODUCTION_CERT_PASSWORD
                    
                    success, msg = config.save_settings_to_env(
                        c_uid, c_pwd, c_cert, c_cpwd, 
                        config.TELEGRAM_BOT_TOKEN, config.TELEGRAM_CHAT_ID, 
                        current_env_code,
                        risk_min=min_risk_level,
                        risk_margin=margin_per_contract,
                        risk_equity=manual_equity
                    )
                    if success:
                        st.success("✅ 風險設定已儲存！")
                        # Update memory config
                        config.RISK_MIN_LEVEL = min_risk_level
                        config.RISK_MARGIN_PER_CONTRACT = margin_per_contract
                        config.RISK_MANUAL_EQUITY = manual_equity
                    else:
                        st.error(f"❌ 儲存失敗: {msg}")
    
                # Display current risk
                curr_risk = 0
                risk_source = "N/A"
                
                # 1. Try API
                if st.session_state.provider and st.session_state.provider.is_logged_in:
                    eq_info = st.session_state.provider.get_equity()
                    if eq_info and eq_info.get('risk_index', 0) > 0:
                        curr_risk = eq_info.get('risk_index', 0)
                        risk_source = "API (自動)"
                
                # 2. Fallback to Manual Calculation
                if curr_risk == 0:
                    # Calculate: Equity / (Positions * Margin)
                    # We need current positions.
                    # current_mxf_qty is available in local scope? Yes, fetched earlier.
                    # But wait, current_mxf_qty might be 0.
                    total_margin_req = abs(current_mxf_qty) * margin_per_contract
                    if total_margin_req > 0:
                        curr_risk = (manual_equity / total_margin_req) * 100
                        risk_source = "手動計算 (Manual)"
                    elif manual_equity > 0:
                        curr_risk = 9999 # Safe (No positions)
                        risk_source = "手動 (無部位)"
                
                risk_color = "green" if curr_risk >= min_risk_level else "red"
                st.markdown(f"目前風險指標: <span style='color:{risk_color}; font-weight:bold'>{curr_risk:.2f}%</span> ({risk_source})", unsafe_allow_html=True)
                
                # Update AutoTrader Params
                AutoTrader().params['min_risk_level'] = min_risk_level
                AutoTrader().params['manual_equity'] = manual_equity
                AutoTrader().params['margin_per_contract'] = margin_per_contract

        st.markdown("---")

        # --- Data Processing ---
        ma_df = get_ma_data(ma_period)
        
        current_index = tx_price 
        
        ma_value = 0
        if not ma_df.empty:
            ma_value = ma_df['MA'].iloc[-1]
            
        diff_percent = 0
        diff_points = 0
        if ma_value > 0:
            diff_points = current_index - ma_value
            diff_percent = diff_points / ma_value * 100

        # Hedge Logic (3-Stage)
        hedge_status = "🟢 安全 (Safe)"
        target_hedge_ratio = 0.0
        
        if diff_percent < -hedge_threshold_3:
            hedge_status = "🔴 危險 - 觸發第三階避險 (Level 3)"
            target_hedge_ratio = hedge_ratio_3
        elif diff_percent < -hedge_threshold_2:
            hedge_status = "🟠 警戒 - 觸發第二階避險 (Level 2)"
            target_hedge_ratio = hedge_ratio_2
        elif diff_percent < -hedge_threshold_1:
            hedge_status = "🟡 注意 - 觸發第一階避險 (Level 1)"
            target_hedge_ratio = hedge_ratio_1
            
        target_hedge_value = exposure_value * target_hedge_ratio
        
        target_mxf_qty = 0
        if mxf_contract_value > 0:
            target_mxf_qty = round(target_hedge_value / mxf_contract_value, 1)
            
        # Prepare params
        hedge_params = {
            'hedge_threshold_1': hedge_threshold_1,
            'hedge_threshold_2': hedge_threshold_2,
            'hedge_threshold_3': hedge_threshold_3,
            'hedge_ratio_1': hedge_ratio_1,
            'hedge_ratio_2': hedge_ratio_2,
            'hedge_ratio_3': hedge_ratio_3,
            # Rebound Params
            'rebound_threshold_1': rebound_threshold_1,
            'rebound_threshold_2': rebound_threshold_2,
            'rebound_threshold_3': rebound_threshold_3,
            'cover_ratio_1': cover_ratio_1,
            'cover_ratio_2': cover_ratio_2,
            'cover_ratio_3': cover_ratio_3
        }
        
        # Calculate Action
        result = calculate_strategy_state(
            current_index, 
            ma_value, 
            etf_qty, 
            etf_price,
            current_mxf_qty, 
            hedge_params
        )
        
        # Update AutoTrader with latest context
        if 'auto_trader' in locals():
            auto_trader.provider = st.session_state.provider # Still needed for data?
            # Actually AutoTrader needs the BROKER to execute.
            auto_trader.broker = st.session_state.broker 
            
            auto_trader.params = {
                **hedge_params,
                'ma_value': ma_value,
                'exposure_value': exposure_value,
                'mxf_contract_value': mxf_contract_value,
                'current_mxf_qty': current_mxf_qty,
                'current_index': current_index,
                'etf_price': etf_price,
                'etf_price': etf_price,
                'etf_qty': etf_qty,
                'auto_trade_time': auto_trade_time # Pass configured time
            }
            
            # Execute Auto-Trade Logic if enabled
            if auto_trader.enabled and st.session_state.broker:
                # Calculate signal again or use result?
                # Let's use the result we just calculated
                # result = calculate_hedge_action(...)
                
                # Check Time (Configurable)
                now = datetime.now()
                
                # Check if within 1 minute of scheduled time
                is_time = (now.hour == auto_trade_time.hour and now.minute == auto_trade_time.minute)
                
                # Allow manual trigger in Mock mode for testing
                manual_trigger = False
                if env_mode == "模擬交易 (Mock)":
                     pass
                
                if is_time:
                    # Check if already run today
                    today_str = now.strftime("%Y-%m-%d")
                    if auto_trader.last_run_date != today_str:
                        # Execute!
                        st.toast("🤖 自動下單啟動...", icon="🤖")
                        
                        # Determine Action from result
                        # result['action_needed'] -> 'Short', 'Cover', 'Hold'
                        # result['qty_diff'] -> Quantity to trade
                        
                        action = result['action_needed']
                        qty = abs(result['qty_diff'])
                        
                        if action != "Hold" and qty > 0:
                            # Place Order
                            # Symbol? Need to determine symbol.
                            # Use the same logic as Tab 3 or hardcode MXF?
                            # Let's use a helper to get symbol
                            target_sym = "MXF" # Default
                            # Try to find current month symbol
                            try:
                                month_codes = "ABCDEFGHIJKL"
                                m_code = month_codes[now.month - 1]
                                y_digit = str(now.year)[-1]
                                target_sym = f"MXF{m_code}{y_digit}"
                            except:
                                pass
                                
                            st.info(f"🤖 自動下單執行: {action} {qty} {target_sym}")
                            
                            res = st.session_state.broker.place_order(
                                symbol=target_sym,
                                action="Sell" if action == "Short" else "Buy", # Short=Sell, Cover=Buy
                                quantity=qty,
                                price=current_index, # Market Order? Or Limit at current price?
                                # MockBroker fills at any price. Real broker might need Better Price.
                                # Let's use current_index as price for now.
                                order_type="LMT"
                            )
                            
                            if res.get("success") or (hasattr(res, 'is_success') and res.is_success):
                                msg = f"自動下單成功: {action} {qty}"
                                st.success(f"✅ {msg}")
                                auto_trader.last_run_date = today_str
                                
                                # Log to UI
                                order_info = {
                                    'type': 'ORDER',
                                    'function': 'Auto-Bot',
                                    'symbol': target_sym,
                                    'action': "Sell" if action == "Short" else "Buy",
                                    'price': current_index,
                                    'quantity': qty,
                                    'simple_status': 'Success',
                                    'message': msg,
                                    'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                                }
                                handle_order_update(order_info)
                                
                                # Save to Firebase
                                if st.session_state.db and st.session_state.db.is_connected:
                                    st.session_state.db.save_order(order_info)
                                    st.toast("☁️ 自動委託已同步至雲端")
                            else:
                                st.error(f"❌ 自動下單失敗: {res}")
                        else:
                            # Log No Action
                            log_entry = {
                                'type': 'CHECK',
                                'function': 'Auto Check',
                                'message': '無需動作 (No Action Needed)',
                                'symbol': 'N/A',
                                'action': 'Hold',
                                'price': current_index,
                                'quantity': 0,
                                'simple_status': 'Success'
                            }
                            handle_order_update(log_entry)
                            
                            # Persist to No Action Logs for Table
                            st.session_state.no_action_logs.append({
                                'account': 'Auto-Check',
                                'order_no': 'N/A',
                                'symbol': 'N/A',
                                'action': 'Hold',
                                'price': current_index,
                                'quantity': 0,
                                'filled_qty': 0,
                                'status': 'No Action',
                                'time': datetime.now().strftime("%Y/%m/%d %H:%M:%S"),
                                'message': '無需動作 (No Action Needed)'
                            })
                            
                            auto_trader.last_run_date = today_str
                            
        # Unpack results
        hedge_status = result['hedge_status']
        target_hedge_ratio = result['target_hedge_ratio']
        target_mxf_qty = result['target_mxf_qty']
        action_needed = result['action_needed']
        qty_diff = result['qty_diff']
        diff_percent = result['diff_percent']
        diff_points = result['diff_points']
        
        # Define target_qty_int for display
        target_qty_int = int(round(target_mxf_qty))

        # 1. Strategy Levels (Separated)
        st.subheader("1️⃣ 策略位階試算 (Strategy Levels)")
        
        tab_h, tab_r = st.tabs(["📉 避險試算 (Entry)", "📈 反彈試算 (Exit)"])
        
        with tab_h:
            st.caption("當大盤 **下跌** 至以下點位時，應 **增加** 避險部位")
            hedge_data = []
            def add_hedge_row(name, threshold_pct, ratio):
                price = ma_value * (1 - threshold_pct/100)
                diff_points = price - ma_value
                dist = current_index - price
                target_q = int(round(total_contracts_needed * ratio))
                
                status = ""
                if current_index < price: status = "✅ 已觸發"
                else: status = f"再跌 {dist:.0f} 點"
                
                hedge_data.append({
                    "位階": name,
                    "門檻": f"-{threshold_pct}%",
                    "觸發價": f"{price:.0f}",
                    "目標口數": f"{target_q} 口",
                    "狀態": status
                })
            
            add_hedge_row("第一階", hedge_threshold_1, hedge_ratio_1)
            add_hedge_row("第二階", hedge_threshold_2, hedge_ratio_2)
            add_hedge_row("第三階", hedge_threshold_3, hedge_ratio_3)
            st.table(pd.DataFrame(hedge_data))

        with tab_r:
            st.caption("當大盤 **反彈** 至以下點位時，應 **減少** 避險部位 (回補)")
            rebound_data = []
            def add_rebound_row(name, threshold_pct, target_q, cover_q):
                # Rebound Logic: Index > MA * (1 + threshold/100)
                price = ma_value * (1 + threshold_pct/100)
                dist = price - current_index
                
                # Projected Action
                action_q = current_mxf_qty - target_q
                action_str = ""
                if action_q > 0:
                    action_str = f"回補 {action_q} 口"
                elif action_q < 0:
                    # In Rebound Mode, we do NOT Short even if Current < Target
                    # We only Hold.
                    action_str = f"維持 (Hold)" 
                else:
                    action_str = "無動作"
                
                status = ""
                if current_index > price: status = "✅ 已收復"
                else: status = f"再漲 {dist:.0f} 點"
                
                threshold_str = f"{threshold_pct:+.1f}%"
                
                rebound_data.append({
                    "回升至": name,
                    "門檻": threshold_str,
                    "觸發價": f"{price:.0f}",
                    "目標口數": f"回補 {cover_q} | 剩 {target_q}",
                    "預估操作": action_str,
                    "狀態": status
                })
            
            # Rebound order: Stage 1 -> Stage 2 -> Stage 3
            add_rebound_row("第一階段 (Stage 1)", rebound_threshold_1, est_remain_1, est_cover_1)
            add_rebound_row("第二階段 (Stage 2)", rebound_threshold_2, est_remain_2, est_cover_2)
            add_rebound_row("第三階段 (Stage 3)", rebound_threshold_3, est_remain_3, est_cover_3)
            
            st.table(pd.DataFrame(rebound_data))
            
        st.markdown("---")

        
        if qty_diff > 0:
            action_needed = "Short" # Need more hedge
        elif qty_diff < 0:
            action_needed = "Cover" # Need to reduce hedge (Rebound)

        # --- Display ---
        
        # 2. Market Status
        st.subheader("2️⃣ 市場狀態")
        col_m1, col_m2, col_m3, col_m4 = st.columns(4)
        with col_m1:
            st.metric("台指期 (Index Proxy)", f"{current_index:.0f}", f"{tx_change:.0f}")
        with col_m2:
            st.metric(f"{ma_period}MA (日線)", f"{ma_value:.0f}")
        with col_m3:
            color = "normal"
            if diff_percent < 0: color = "inverse"
            st.metric("乖離 (Deviation)", f"{diff_percent:.2f}%", delta=f"{diff_points:+.0f} 點", delta_color=color)
        with col_m4:
            st.metric("00631L 價格", f"{etf_price:.2f}")

        # 3. Position & Hedge
        st.subheader("3️⃣ 部位與避險建議")
        col_h1, col_h2, col_h3 = st.columns(3)
        with col_h1:
            st.info(f"**持有部位**\n\n00631L: {etf_qty} 張\n\n市值: ${etf_market_value:,.0f}\n\n**約當曝險: ${exposure_value:,.0f}**")
        with col_h2:
            st.warning(f"**避險狀態**\n\n{hedge_status}\n\n目標避險比例: {target_hedge_ratio*100:.0f}%")
        with col_h3:
            if action_needed == "Short":
                st.error(f"**建議操作: 加空 (Short)**\n\n目標: {target_qty_int} 口\n目前: {current_mxf_qty} 口\n\n👉 **賣出 {qty_diff} 口 MXF**")
            elif action_needed == "Cover":
                st.success(f"**建議操作: 回補 (Cover)**\n\n目標: {target_qty_int} 口\n目前: {current_mxf_qty} 口\n\n👉 **買進 {abs(qty_diff)} 口 MXF**")
            else:
                st.info(f"**建議操作: 續抱 (Hold)**\n\n目標: {target_qty_int} 口\n目前: {current_mxf_qty} 口\n\n無需動作")

        # 4. Chart
        st.subheader("4️⃣ 趨勢圖表")
        if not ma_df.empty:
            fig = go.Figure()
            # Close Price
            fig.add_trace(go.Scatter(
                x=ma_df.index, 
                y=ma_df['Close'], 
                mode='lines', 
                name='收盤價 (Close)',
                line=dict(color='#1f77b4', width=2)
            ))
            # MA
            fig.add_trace(go.Scatter(
                x=ma_df.index, 
                y=ma_df['MA'], 
                mode='lines', 
                name=f'{ma_period}MA',
                line=dict(color='#ff7f0e', width=2, dash='dash')
            ))
            
            fig.update_layout(
                height=400,
                margin=dict(l=10, r=10, t=30, b=10),
                legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
                hovermode="x unified",
                template=template_name
            )
            # Dynamic Y-axis (autorange=True usually avoids 0 for line charts, but we can be explicit if needed)
            fig.update_yaxes(autorange=True, fixedrange=False)
            
            st.plotly_chart(fig, use_container_width=True)
        else:
            if st.button("🔄 重試 (Retry)", help="清除快取並重新嘗試取得數據"):
                get_ma_data.clear()
                st.rerun()
    except Exception as e:
        st.error(f"Tab 1 Error: {e}")
        import traceback
        st.code(traceback.format_exc())

    # --- Tab 2: Backtest ---
# --- Tab 2: Backtest ---
with tab2:
    st.header("📊 策略回測 (Backtest)")
    st.markdown("使用歷史數據驗證策略邏輯。")
    
    col_b1, col_b2 = st.columns([1, 3])
    
    with col_b1:
        st.subheader("回測參數")
        bt_capital = st.number_input("初始資金 (TWD)", value=1200000, step=100000)
        bt_ma = st.number_input("MA 週期", value=13)
        
        if st.button("🚀 開始回測", type="primary"):
            with st.spinner("正在執行回測 (約需 10-20 秒)..."):
                try:
                    from backtest_00631l import run_backtest_engine
                    res_df, initial_total = run_backtest_engine(initial_capital=bt_capital, ma_period=bt_ma)
                    
                    if res_df is not None:
                        st.session_state['bt_result'] = res_df
                        st.session_state['bt_initial'] = initial_total
                        st.success("回測完成！")
                    else:
                        st.error("回測失敗：無法取得數據")
                except Exception as e:
                    st.error(f"回測發生錯誤: {e}")
    
    with col_b2:
        if 'bt_result' in st.session_state:
            res_df = st.session_state['bt_result']
            initial_total = st.session_state['bt_initial']
            
            # Metrics
            final_eq = res_df['Equity'].iloc[-1]
            final_bench = res_df['Benchmark'].iloc[-1]
            ret = (final_eq - initial_total) / initial_total
            bench_ret = (final_bench - initial_total) / initial_total
            max_dd = res_df['DD'].min()
            bench_max_dd = res_df['Bench_DD'].min()
            
            # Display Metrics
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("策略總報酬", f"{ret*100:.1f}%", f"${final_eq - initial_total:,.0f}")
            m2.metric("基準 (00631L) 報酬", f"{bench_ret*100:.1f}%", f"${final_bench - initial_total:,.0f}")
            m3.metric("策略最大回檔", f"{max_dd*100:.1f}%", delta_color="inverse")
            m4.metric("基準最大回檔", f"{bench_max_dd*100:.1f}%", delta_color="inverse")
            
            st.markdown("---")
            
            # Charts (Altair)
            
            # Charts (Altair Disabled)
            # import altair as alt
            
            # 1. Equity Curve
            st.subheader("權益曲線 (Equity Curve)")
            # Rename for Chart
            chart_res_df = res_df.rename(columns={
                'Equity': '策略權益', 
                'Benchmark': '基準權益',
                'DD': '策略回檔',
                'Bench_DD': '基準回檔'
            })
            
            st.line_chart(chart_res_df[['策略權益', '基準權益']])
            
            # 2. Drawdown
            st.subheader("回檔幅度 (Drawdown)")
            st.line_chart(chart_res_df[['策略回檔', '基準回檔']])
            
            # 3. Hedge Ratio
            st.subheader("避險比例 (Hedge Ratio)")
            st.line_chart(res_df['Hedge_Ratio'])
            
            # 4. Detailed Log
            with st.expander("📄 詳細交易紀錄 (Detailed Log)"):
                # Rename columns for display
                display_df = res_df.copy()
                display_df.index.name = '日期'
                
                col_map = {
                    'Equity': '策略權益',
                    'Hedge_Ratio': '避險比例',
                    'Hedge_Qty': '避險口數',
                    'Index': '大盤指數',
                    'MA': '均線',
                    'Diff_Pct': '乖離率',
                    'ETF_Price': 'ETF 價格',
                    'Benchmark': '基準權益',
                    'Peak': '策略高點',
                    'DD': '策略回檔',
                    'Bench_Peak': '基準高點',
                    'Bench_DD': '基準回檔'
                }
                display_df = display_df.rename(columns=col_map)
                
                st.dataframe(display_df.sort_index(ascending=False).style.format({
                    '策略權益': '{:,.0f}',
                    '基準權益': '{:,.0f}',
                    '避險比例': '{:.2f}',
                    '大盤指數': '{:.0f}',
                    '均線': '{:.0f}',
                    '乖離率': '{:.2f}%',
                    '策略回檔': '{:.2%}',
                    '基準回檔': '{:.2%}'
                }))


# --- Tab 3: Real Trading ---
with tab3:
    if current_env_code == "TEST":
        st.header("🧪 測試環境交易 (Test Trading)")
        st.info("目前為測試模式，下單不會產生實際損益。")
    else:
        st.header("💰 真實交易 (Real Trading)")
        st.error("⚠️ 警告：目前為正式環境，下單將產生實際損益！請謹慎操作。")
        # You can add an image here if needed, e.g. st.image("warning.png")
    # st.info("功能維護中 (Function under maintenance)")
    if not st.session_state.provider or not st.session_state.provider.is_logged_in:
        st.warning("請先在側邊欄連接 API")
    else:
        # Create 2-column layout
        col_monitor, col_action = st.columns([3, 2])
        
        with col_monitor:
            try:
                # 1. Inventory
                st.subheader("📊 帳戶與庫存 (Inventory)")
                col_eq1, col_eq2, col_eq3 = st.columns(3)
                
                equity_info = provider.get_equity()
                
                if equity_info:
                    with col_eq1:
                        st.metric("權益數 (Equity)", f"${equity_info.get('equity', 0):,.0f}")
                    with col_eq2:
                        st.metric("未平倉損益 (PnL)", f"${equity_info.get('pnl', 0):,.0f}", delta_color="normal")
                    with col_eq3:
                        st.metric("風險指標 (Risk)", f"{equity_info.get('risk_index', 0):.1f}%")
                
                positions = provider.get_positions()
                
                if positions:
                    st.dataframe(pd.DataFrame(positions), use_container_width=True)
                else:
                    st.info("目前無持倉")
            except Exception as e:
                st.error(f"Inventory Error: {e}")
                
            st.divider()
            
            # 3. Active Orders (Moved to Left Column)
            st.subheader("📝 委託紀錄 (Orders)")
            orders = provider.get_orders()
            
            # Convert API Orders to DataFrame
            if isinstance(orders, list):
                df_orders = pd.DataFrame(orders)
            else:
                df_orders = pd.DataFrame() # Handle empty or error
                
            # Fetch Firebase Orders
            if st.session_state.db and st.session_state.db.is_connected:
                fb_orders = st.session_state.db.fetch_orders(limit=20)
                if fb_orders:
                    df_fb = pd.DataFrame(fb_orders)
                    # Normalize columns if needed
                    if 'created_at' in df_fb.columns:
                        df_fb['time'] = df_fb['created_at']
                    
                    # Merge
                    if not df_orders.empty:
                        df_orders = pd.concat([df_orders, df_fb], ignore_index=True)
                    else:
                        df_orders = df_fb
                
            # Merge with No Action Logs
            if 'no_action_logs' in st.session_state and st.session_state.no_action_logs:
                df_no_action = pd.DataFrame(st.session_state.no_action_logs)
                if not df_orders.empty:
                    df_orders = pd.concat([df_orders, df_no_action], ignore_index=True)
                else:
                    df_orders = df_no_action
                    
            # Sort by time if available
            if not df_orders.empty and 'time' in df_orders.columns:
                try:
                    df_orders['time'] = pd.to_datetime(df_orders['time'])
                    df_orders = df_orders.sort_values(by='time', ascending=False)
                except:
                    pass

            st.dataframe(df_orders, use_container_width=True)

        with col_action:
            # 2. Order Placement (Moved to Right Column)
            st.subheader("⚡ 下單 (Place Order)")
            
            # 1. Auto-calculate default symbol and price for Micro Tai (MXF)
            default_symbol = ""
            default_price = 0.0
            chinese_desc = "微台近月"
            
            try:
                # Correct Futures Month Codes (Using A-L to match DataProvider/Fubon API behavior)
                month_codes = "ABCDEFGHIJKL"
                now = datetime.now()
                m_code = month_codes[now.month - 1]
                y_digit = str(now.year)[-1]
                
                # Hardcoded for Micro Tai
                target_prefix = "MXF" 
                sym = f"{target_prefix}{m_code}{y_digit}"
                
                # Check price / rollover
                p = provider.get_price_by_symbol(sym)
                if p == 0:
                    next_m = now.month + 1 if now.month < 12 else 1
                    m_code_next = month_codes[next_m - 1]
                    y_digit_next = str(now.year if now.month < 12 else now.year + 1)[-1]
                    sym = f"{target_prefix}{m_code_next}{y_digit_next}"
                    p = provider.get_price_by_symbol(sym)
                    chinese_desc = "微台次月 (近月無報價)"
                
                default_symbol = sym
                default_price = p
            except:
                pass

            # --- Order Placement Form ---
            
            # Display Quotes for the default symbol
            if default_symbol:
                st.markdown(f"**📊 即時報價: {default_symbol} ({chinese_desc})**")
                q_col1, q_col2, q_col3, q_col4 = st.columns(4)
                
                # Fetch full quote
                quote_data = provider.get_quote(default_symbol)
                
                last_p = quote_data.get('lastPrice', default_price)
                change_val = quote_data.get('change', 0)
                change_pct = quote_data.get('changePercent', 0)
                bid_p = quote_data.get('bid', 0)
                ask_p = quote_data.get('ask', 0)
                
                # Fallback estimation if bid/ask not available
                if bid_p == 0 and last_p > 0: bid_p = last_p - 1
                if ask_p == 0 and last_p > 0: ask_p = last_p + 1
                
                with q_col1:
                    st.metric("成交價 (Last)", f"{last_p}")
                with q_col2:
                    color = "normal"
                    if change_val > 0: color = "normal" 
                    st.metric("漲跌 (Chg)", f"{change_val}", f"{change_pct}%")
                with q_col3:
                    st.metric("買進價 (Bid)", f"{bid_p}") 
                with q_col4:
                    st.metric("賣出價 (Ask)", f"{ask_p}")
            
            with st.form("order_form"):
                # 1. Symbol Selection (Auto-Fill)
                order_symbol = st.text_input("商品代碼 (Symbol)", value=default_symbol, help="例如: MXFL5", key="order_sym_input")
                
                col_type, col_action_in = st.columns(2)
                with col_type:
                    st.info("Future (Small TX)")
                with col_action_in:
                    action = st.selectbox("買賣", ["Buy", "Sell"])

                col_qty, col_price = st.columns(2)
                with col_qty:
                    quantity = st.number_input("口數", min_value=1, value=1)
                with col_price:
                    # Auto-fill price
                    default_price_in = 0.0
                    if 'tx_price' in locals():
                        default_price_in = float(tx_price)
                    price = st.number_input("價格", min_value=0.0, value=default_price_in, step=1.0)

                submit_order = st.form_submit_button("送出委託", type="primary", use_container_width=True)

                if submit_order:
                    if not st.session_state.broker: # Use broker check
                        st.error("請先連接 API 或啟動模擬環境")
                    else:
                        # Use Broker Interface
                        result = st.session_state.broker.place_order(
                            symbol=order_symbol,
                            action=action,
                            quantity=quantity,
                            price=price,
                            order_type="LMT"
                        )
                        
                        if result.get("success") or (hasattr(result, 'is_success') and result.is_success): 
                            msg = ""
                            if isinstance(result, dict):
                                msg = result.get('message', 'Order Sent')
                            else:
                                msg = result.message if result else "Order Sent"
                                
                            st.success(f"✅ 委託成功: {msg}")
                            
                            # Log to UI
                            order_info = {
                                'type': 'ORDER',
                                'function': 'Place Order',
                                'symbol': order_symbol,
                                'action': action,
                                'price': price,
                                'quantity': quantity,
                                'simple_status': 'Success',
                                'message': msg,
                                'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            }
                            handle_order_update(order_info)
                            
                            # Save to Firebase
                            if st.session_state.db and st.session_state.db.is_connected:
                                st.session_state.db.save_order(order_info)
                                st.toast("☁️ 委託已同步至雲端")
                        else:
                            err = ""
                            if isinstance(result, dict):
                                err = result.get('message', 'Unknown Error')
                            else:
                                err = result.message if result else "Unknown Error"
                            st.error(f"❌ 委託失敗: {err}")


with tab4:
    st.header("📉 均值回歸 (Mean Reversion) 策略")
    st.caption("基於乖離率 (Deviation from MA) 的網格交易策略模擬")
    
    # --- Layout ---
    col_param, col_sim = st.columns([1, 2])
    
    with col_param:
        st.subheader("⚙️ 參數設定")
        
        # 1. Target
        # Use session state to persist input
        if 'mr_symbol' not in st.session_state: st.session_state.mr_symbol = "MXF"
        mr_symbol = st.text_input("交易商品", value=st.session_state.mr_symbol, help="例如: MXF (微台)", key="mr_sym_input")
        st.session_state.mr_symbol = mr_symbol

        # Contract Type
        mr_contract_type = st.radio("合約規格", ["微台 (Micro, $10)", "小台 (Small, $50)"], horizontal=True, key="mr_ctype_in")
        mr_point_value = 10 if "Micro" in mr_contract_type else 50


        # 2. Parameters
        mr_ma_period = st.number_input("均線週期 (MA Period)", min_value=5, value=60, step=1, key="mr_ma_in")
        mr_grid_gap = st.number_input("網格間距 (Grid Gap 點數)", min_value=10, value=100, step=10, key="mr_gap_in")
        mr_take_profit = st.number_input("獲利點數 (Take Profit)", min_value=10, value=100, step=10, key="mr_tp_in")
        
        # Risk / Margin
        st.caption("Risk / Margin")
        mr_capital = st.number_input("初始資金 (Capital)", min_value=10000, value=1000000, step=10000, key="mr_cap_in")
        def_margin = 12000 if mr_point_value == 10 else 60000
        mr_margin = st.number_input("每口保證金 (Margin)", min_value=1000, value=def_margin, step=1000, key="mr_marg_in")
        
        # Max Pos Calculation
        max_purchasable = int(mr_capital / mr_margin) if mr_margin > 0 else 0
        mr_max_pos = st.number_input(f"最大持倉 (Max: {max_purchasable})", min_value=1, value=min(5, max_purchasable), step=1, key="mr_max_in")
        
        if mr_max_pos > max_purchasable:
            st.warning(f"⚠️ 設定口數 ({mr_max_pos}) 超過資金上限 ({max_purchasable}口)")
        
        st.divider()
        
        # 3. Operations
        if st.button("🗑️ 清空策略狀態 (Reset)", use_container_width=True):
            st.session_state.mr_positions = []
            st.session_state.mr_logs = []
            st.success("已重置策略狀態")
            st.rerun()

    with col_sim:
        st.subheader("📊 即時監控與模擬")
        
        # Fetch Data
        if st.session_state.provider:
            # Get MA
            # Use cached get_kline_data to avoid limits if possible?
            # Or direct call. Let's use direct call but maybe check session state data?
            # The app already has a 'get_ma_data' function inside tab1 but it's local scope.
            # We'll re-fetch.
            mr_df = st.session_state.provider.get_kline_data("^TWII", period="1y") # Need long enough for 60MA
            
            if not mr_df.empty:
                # Calculate Indicators
                mr_df = MeanReversionStrategy.calculate_indicators(mr_df, mr_ma_period)
                
                curr_ma = mr_df['MA'].iloc[-1]
                curr_std = mr_df['StdDev'].iloc[-1]
                curr_atr = mr_df['ATR'].iloc[-1]
                
                # Get Real-time Price
                # tx_price is available from global scope (line 352)
                mr_current_price = tx_price 
                
                # Display Metrics
                m1, m2, m3 = st.columns(3)
                m1.metric("目前指數", f"{mr_current_price:.0f}")
                m2.metric(f"均線 ({mr_ma_period}MA)", f"{curr_ma:.0f}")
                
                dev_points = mr_current_price - curr_ma
                dev_std = dev_points / curr_std if curr_std and curr_std > 0 else 0
                m3.metric("乖離差 (Diff)", f"{dev_points:.0f}", f"{dev_std:.1f} σ")
                
                # Strategy Evaluation
                strategy_res = MeanReversionStrategy.evaluate_signal(
                    mr_current_price, 
                    curr_ma, 
                    st.session_state.mr_positions, 
                    config={
                        'grid_gap': mr_grid_gap,
                        'take_profit': mr_take_profit,
                        'max_positions': mr_max_pos
                    }
                )
                
                # Next Levels
                st.markdown("#### 🎯 下一步提示")
                
                # Buy Level
                next_buy = "N/A"
                if not st.session_state.mr_positions:
                    next_buy = curr_ma - mr_grid_gap
                else:
                    lowest = min(p['price'] for p in st.session_state.mr_positions)
                    next_buy = lowest - mr_grid_gap
                
                # Sell Level (Lowest TP)
                next_sell = "N/A"
                if st.session_state.mr_positions:
                    # Find closest sell target
                    sell_targets = [p['price'] + mr_take_profit for p in st.session_state.mr_positions]
                    if sell_targets:
                        next_sell = min(sell_targets)
                
                nb_col, ns_col = st.columns(2)
                nb_val = f"{next_buy:.0f}" if isinstance(next_buy, (int, float)) else next_buy
                ns_val = f"{next_sell:.0f}" if isinstance(next_sell, (int, float)) else next_sell
                
                nb_col.info(f"⬇️ 下次買點: {nb_val}")
                ns_col.warning(f"⬆️ 下次賣點: {ns_val}")

                # Action Button
                if strategy_res['action'] != 'HOLD':
                    # st.toast(f"策略訊號: {strategy_res['action']} - {strategy_res['reason']}", icon="🔔")
                    
                    st.info(f"💡 建議動作: **{strategy_res['action']}** ({strategy_res['reason']})")
                    
                    if st.button(f"執行 {strategy_res['action']} (模擬下單)", type="primary", key="btn_exec_mr"):
                        # Execute Logic
                        if strategy_res['action'] == 'BUY':
                            new_pos = {
                                'price': strategy_res['price'],
                                'qty': 1,
                                'time': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            }
                            st.session_state.mr_positions.append(new_pos)
                            msg = f"已買入 @ {strategy_res['price']:.0f}"
                            st.session_state.mr_logs.insert(0, f"[{new_pos['time']}] BUY {mr_symbol} @ {strategy_res['price']:.0f}")
                            st.success(msg)
                            st.rerun()
                            
                        elif strategy_res['action'] == 'SELL':
                            idx = strategy_res['matched_position_index']
                            pos = st.session_state.mr_positions.pop(idx)
                            pnl = (strategy_res['price'] - pos['price']) * mr_point_value
                            
                            log_msg = f"[{datetime.now().strftime('%H:%M:%S')}] SELL {mr_symbol} @ {strategy_res['price']:.0f} (Cost: {pos['price']:.0f}), PnL: {pnl:.0f}"
                            st.session_state.mr_logs.insert(0, log_msg)
                            st.success(f"已賣出, 獲利: {pnl:.0f}")
                            st.rerun()
                else:
                    st.caption("...等待市場訊號中...")

            else:
                st.warning("⚠️ 無法取得 K 線資料，請檢查 API 連線")
    
    # --- Positions & Logs ---
    st.divider()
    p_col, l_col = st.columns(2)
    
    with p_col:
        st.subheader(f"📦 目前持倉 ({len(st.session_state.mr_positions)})")
        if st.session_state.mr_positions:
            pos_df = pd.DataFrame(st.session_state.mr_positions)
            st.dataframe(pos_df, use_container_width=True)
            
            # Calc Floating PnL
            total_cost = sum(p['price'] for p in st.session_state.mr_positions)
            avg_cost = total_cost / len(st.session_state.mr_positions)
            curr_val = mr_current_price * len(st.session_state.mr_positions)
            float_pnl = (curr_val - total_cost) * mr_point_value
            
            st.caption(f"平均成本: {avg_cost:.0f}")
            pnl_color = "green" if float_pnl >= 0 else "red"
            st.markdown(f"**未實現損益: <span style='color:{pnl_color}'>{float_pnl:,.0f}</span>**", unsafe_allow_html=True)
        else:
            st.info("尚無持倉")
            
    with l_col:
        st.subheader("📝 交易紀錄")
        if st.session_state.mr_logs:
            for log in st.session_state.mr_logs[:10]:
                st.text(log)
        else:
            st.caption("尚無紀錄")
    
    # --- Backtest Section ---
    st.divider()
    with st.expander("⏮️ 歷史回測 (Backtest)", expanded=False):
        st.caption("使用 Yahoo Finance 歷史資料進行策略驗證")
        
        # Contract Type is Global now (mr_point_value)
        
        bt_col1, bt_col2, bt_col3 = st.columns(3)
        with bt_col1:
            bt_ticker = st.text_input("回測代號 (Yahoo)", value="^TWII")
        with bt_col2:
            bt_start = st.date_input("開始日期", value=datetime.today() - timedelta(days=365))
        with bt_col3:
            bt_end = st.date_input("結束日期", value=datetime.today())
            
        if st.button("🚀 執行回測 (Run Backtest)", type="primary"):
            with st.spinner("正在下載資料並執行回測..."):
                try:
                    bt_res = MeanReversionStrategy.run_backtest(
                        ticker=bt_ticker,
                        start_date=bt_start.strftime("%Y-%m-%d"),
                        end_date=bt_end.strftime("%Y-%m-%d"),
                        ma_period=mr_ma_period,
                        grid_gap=mr_grid_gap,
                        take_profit=mr_take_profit,
                        max_positions=mr_max_pos,
                        initial_capital=mr_capital,
                        point_value=mr_point_value,
                        margin_per_contract=mr_margin
                    )
                    
                    if 'error' in bt_res:
                        st.error(f"回測失敗: {bt_res['error']}")
                    else:
                        # Display Results
                        st.success("✅ 回測完成!")
                        
                        # Metrics
                        m_b1, m_b2, m_b3, m_b4 = st.columns(4)
                        m_b1.metric("最終權益", f"${bt_res['final_equity']:,.0f}")
                        m_b2.metric("總損益", f"${bt_res['total_return']:,.0f}", f"{(bt_res['total_return']/1000000)*100:.1f}%")
                        m_b3.metric("最大浮虧 (MDD)", f"${bt_res['max_drawdown']:,.0f}")
                        m_b4.metric("交易次數", f"{bt_res['trade_count']}")
                        
                        # Chart
                        bt_df = bt_res['df']
                        fig = go.Figure()
                        fig.add_trace(go.Scatter(x=bt_df.index, y=bt_df['Close'], name="Close", line=dict(color='gray', width=1)))
                        fig.add_trace(go.Scatter(x=bt_df.index, y=bt_df['MA'], name=f"MA{mr_ma_period}", line=dict(color='orange', width=2)))
                        
                        # Add Trades
                        history = bt_res['history']
                        longs_x = [h['date'] for h in history if h['action'] == 'Long']
                        longs_y = [h['price'] for h in history if h['action'] == 'Long']
                        shorts_x = [h['date'] for h in history if h['action'] == 'Short']
                        shorts_y = [h['price'] for h in history if h['action'] == 'Short']
                        
                        closes_long_x = [h['date'] for h in history if h['action'] == 'CloseLong']
                        closes_long_y = [h['price'] for h in history if h['action'] == 'CloseLong']
                        closes_short_x = [h['date'] for h in history if h['action'] == 'CloseShort']
                        closes_short_y = [h['price'] for h in history if h['action'] == 'CloseShort']
                        
                        fig.add_trace(go.Scatter(x=longs_x, y=longs_y, mode='markers', name='Long', marker=dict(color='green', symbol='triangle-up', size=10)))
                        fig.add_trace(go.Scatter(x=shorts_x, y=shorts_y, mode='markers', name='Short', marker=dict(color='red', symbol='triangle-down', size=10)))
                        fig.add_trace(go.Scatter(x=closes_long_x, y=closes_long_y, mode='markers', name='Close Long', marker=dict(color='lime', symbol='circle', size=8)))
                        fig.add_trace(go.Scatter(x=closes_short_x, y=closes_short_y, mode='markers', name='Close Short', marker=dict(color='pink', symbol='circle', size=8)))
                        
                        fig.update_layout(title="回測結果圖表", template="plotly_dark", height=500)
                        st.plotly_chart(fig, use_container_width=True)
                        
                        # Logs
                        with st.expander("詳細交易紀錄"):
                            st.dataframe(pd.DataFrame(history))
                            
                except Exception as e:
                    st.error(f"發生錯誤: {e}")

                

