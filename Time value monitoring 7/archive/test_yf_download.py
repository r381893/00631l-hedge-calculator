import yfinance as yf
import pandas as pd

def test_yf_download():
    symbol = "^TWII"
    print(f"Testing yf.download for {symbol}...")
    try:
        df = yf.download(symbol, period="3mo", progress=False)
        if df.empty:
            print(f"Result is empty for {symbol}")
        else:
            print(f"Successfully retrieved {len(df)} rows for {symbol}")
            print("Columns:", df.columns)
            try:
                close = df['Close']
                print("Close column type:", type(close))
                print(close.head())
            except Exception as e:
                print(f"Error accessing Close: {e}")
    except Exception as e:
        print(f"Exception occurred: {e}")

if __name__ == "__main__":
    test_yf_download()
