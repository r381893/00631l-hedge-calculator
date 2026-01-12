import yfinance as yf
import pandas as pd

try:
    print("Attempting to fetch ^TWII data...")
    ticker = yf.Ticker("^TWII")
    df = ticker.history(period="3mo")
    
    if df.empty:
        print("❌ Dataframe is empty!")
    else:
        print(f"✅ Data fetched successfully! Shape: {df.shape}")
        print(df.head())
        print(df.tail())

except Exception as e:
    print(f"❌ Exception occurred: {e}")
