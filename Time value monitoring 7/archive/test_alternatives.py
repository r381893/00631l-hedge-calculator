import yfinance as yf
import pandas as pd
import time

def test_alternatives():
    symbols = ["^TWII", "0050.TW", "00631L.TW"]
    
    print("--- Testing yfinance ---")
    for sym in symbols:
        print(f"Testing {sym}...")
        try:
            # Add a small delay to avoid hitting rate limit instantly
            time.sleep(2)
            df = yf.download(sym, period="5d", progress=False)
            if not df.empty:
                print(f"[SUCCESS] {sym}: {len(df)} rows")
            else:
                print(f"[EMPTY] {sym}")
        except Exception as e:
            print(f"[ERROR] {sym}: {e}")

if __name__ == "__main__":
    test_alternatives()
