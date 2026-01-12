import yfinance as yf
import pandas as pd

def test_yfinance():
    symbol = "^TWII"
    print(f"Testing yfinance for {symbol}...")
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="3mo")
        if df.empty:
            print(f"❌ Result is empty for {symbol}")
        else:
            print(f"✅ Successfully retrieved {len(df)} rows for {symbol}")
            print(df.head())
            print(df.tail())
    except Exception as e:
        print(f"❌ Exception occurred: {e}")

if __name__ == "__main__":
    test_yfinance()
