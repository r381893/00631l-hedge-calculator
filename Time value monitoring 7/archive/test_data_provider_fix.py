from data_provider import FubonDataProvider
import pandas as pd

def test_fix():
    print("Initializing Provider (expect login failure)...")
    # Dummy credentials
    provider = FubonDataProvider("dummy", "dummy", "dummy", "dummy")
    
    symbol = "^TWII"
    print(f"\nTesting get_kline_data for {symbol}...")
    df = provider.get_kline_data(symbol, period="3mo")
    
    if not df.empty:
        print(f"✅ Success! Retrieved {len(df)} rows.")
        print(df.head())
        print(df.tail())
    else:
        print("❌ Failed: DataFrame is empty.")

if __name__ == "__main__":
    test_fix()
