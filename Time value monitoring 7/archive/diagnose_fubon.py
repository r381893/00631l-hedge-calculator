import config
from data_provider import FubonDataProvider
import sys
import pandas as pd

# Force stdout to utf-8 for Windows console
sys.stdout.reconfigure(encoding='utf-8')

print("--- Starting Diagnosis ---")

# 1. Check Config
print(f"Environment: {config.FUBON_PRODUCTION_USER_ID[:3]}***")
print(f"Cert Path: {config.FUBON_PRODUCTION_CERT_PATH}")

# 2. Initialize Provider
try:
    print("Initializing FubonDataProvider...")
    provider = FubonDataProvider(
        user_id=config.FUBON_PRODUCTION_USER_ID,
        password=config.FUBON_PRODUCTION_PASSWORD,
        cert_path=config.FUBON_PRODUCTION_CERT_PATH,
        cert_password=config.FUBON_PRODUCTION_CERT_PASSWORD,
        api_url=config.FUBON_PRODUCTION_API_URL
    )
    
    if provider.is_logged_in:
        print("✅ Login Successful")
    else:
        print(f"❌ Login Failed: {provider.login_error_message}")
        sys.exit(1)

except Exception as e:
    print(f"❌ Crash during init: {e}")
    sys.exit(1)

# 3. Test Stock Price (00631L)
try:
    print("\nTesting get_stock_price('00631L')...")
    price = provider.get_stock_price("00631L")
    print(f"Result: {price}")
    if price == 0:
        print("⚠️ Warning: Price is 0")
except Exception as e:
    print(f"❌ get_stock_price failed: {e}")

# 4. Test Kline Data (^TWII)
try:
    print("\nTesting get_kline_data('^TWII')...")
    df = provider.get_kline_data("^TWII", period="1mo")
    if not df.empty:
        print(f"✅ Data fetched: {len(df)} rows")
        print(df.head(2))
    else:
        print("⚠️ Warning: DataFrame is empty")
except Exception as e:
    print(f"❌ get_kline_data failed: {e}")

print("\n--- Diagnosis Complete ---")
