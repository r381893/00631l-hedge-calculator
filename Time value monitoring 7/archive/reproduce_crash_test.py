import config
from data_provider import FubonDataProvider
import sys
import time
from datetime import datetime

# Force stdout to utf-8
sys.stdout.reconfigure(encoding='utf-8')

print("--- Starting Test Env Crash Reproduction ---")

# Load Test Credentials from config (which loads from .env)
USER_ID = config.FUBON_TEST_USER_ID
PASSWORD = config.FUBON_TEST_PASSWORD
CERT_PATH = config.FUBON_TEST_CERT_PATH
CERT_PASSWORD = config.FUBON_TEST_CERT_PASSWORD
API_URL = config.FUBON_TEST_API_URL

print(f"User ID: {USER_ID}")
print(f"Cert Path: {CERT_PATH}")
print(f"API URL: {API_URL}")

try:
    print("1. Initializing Provider (Test)...")
    provider = FubonDataProvider(
        user_id=USER_ID,
        password=PASSWORD,
        cert_path=CERT_PATH,
        cert_password=CERT_PASSWORD,
        api_url=API_URL
    )
    
    if not provider.is_logged_in:
        print(f"❌ Login Failed: {provider.login_error_message}", flush=True)
        sys.exit(1)
    print("✅ Login Successful", flush=True)
    time.sleep(1)

    print("\n2. Getting TX Price...", flush=True)
    tx = provider.get_tx_price()
    print(f"Result: {tx}", flush=True)
    time.sleep(1)

    print("\n3. Getting Stock Price (00631L)...", flush=True)
    price = provider.get_stock_price("00631L")
    print(f"Result: {price}", flush=True)
    time.sleep(1)

    print("\n4. Getting MXF Price...", flush=True)
    # Mimic app logic
    month_codes = "ABCDEFGHIJKL"
    now = datetime.now()
    m_code = month_codes[now.month - 1]
    y_digit = str(now.year)[-1]
    mxf_symbol = f"MXF{m_code}{y_digit}"
    print(f"Symbol: {mxf_symbol}", flush=True)
    mxf_p = provider.get_price_by_symbol(mxf_symbol)
    print(f"Result: {mxf_p}", flush=True)
    time.sleep(1)

    print("\n5. Getting Equity (Account Info)...", flush=True)
    eq = provider.get_equity()
    print(f"Result: {eq}", flush=True)
    time.sleep(1)
    
    print("\n6. Getting Positions...", flush=True)
    pos = provider.get_positions()
    print(f"Result: {pos}", flush=True)
    time.sleep(1)
    
    print("\n7. Getting Orders...", flush=True)
    orders = provider.get_orders()
    print(f"Result: {len(orders)} orders", flush=True)

    print("\n--- Reproduction Complete (No Crash) ---")

except BaseException as e:
    print(f"\n❌ CRASHED: {e}")
    import traceback
    traceback.print_exc()
