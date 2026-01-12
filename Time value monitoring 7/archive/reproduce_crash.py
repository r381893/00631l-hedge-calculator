import config
from data_provider import FubonDataProvider
import sys
import time
from datetime import datetime

# Force stdout to utf-8
sys.stdout.reconfigure(encoding='utf-8')

print("--- Starting Crash Reproduction ---")

try:
    print("1. Initializing Provider...")
    provider = FubonDataProvider(
        user_id=config.FUBON_PRODUCTION_USER_ID,
        password=config.FUBON_PRODUCTION_PASSWORD,
        cert_path=config.FUBON_PRODUCTION_CERT_PATH,
        cert_password=config.FUBON_PRODUCTION_CERT_PASSWORD,
        api_url=config.FUBON_PRODUCTION_API_URL
    )
    
    if not provider.is_logged_in:
        print(f"❌ Login Failed: {provider.login_error_message}")
        sys.exit(1)
    print("✅ Login Successful")

    print("\n2. Getting TX Price...")
    tx = provider.get_tx_price()
    print(f"Result: {tx}")

    print("\n3. Getting Stock Price (00631L)...")
    price = provider.get_stock_price("00631L")
    print(f"Result: {price}")

    print("\n4. Getting Kline Data (^TWII)...")
    df = provider.get_kline_data("^TWII", period="3mo")
    print(f"Result: {len(df)} rows")

    print("\n5. Getting MXF Price...")
    # Mimic app logic
    month_codes = "ABCDEFGHIJKL"
    now = datetime.now()
    m_code = month_codes[now.month - 1]
    y_digit = str(now.year)[-1]
    mxf_symbol = f"MXF{m_code}{y_digit}"
    print(f"Symbol: {mxf_symbol}")
    
    mxf_p = provider.get_price_by_symbol(mxf_symbol)
    print(f"Result: {mxf_p}")
    
    if mxf_p == 0:
        print("Trying next month...")
        next_m = now.month + 1 if now.month < 12 else 1
        m_code_next = month_codes[next_m - 1]
        y_digit_next = str(now.year if now.month < 12 else now.year + 1)[-1]
        mxf_symbol = f"MXF{m_code_next}{y_digit_next}"
        print(f"Symbol: {mxf_symbol}")
        mxf_p = provider.get_price_by_symbol(mxf_symbol)
        print(f"Result: {mxf_p}")

    print("\n6. Getting Equity (Account Info)...")
    eq = provider.get_equity() # This is often a source of issues
    print(f"Result: {eq}")

    print("\n--- Reproduction Complete (No Crash) ---")

except BaseException as e:
    print(f"\n❌ CRASHED: {e}")
    import traceback
    traceback.print_exc()
