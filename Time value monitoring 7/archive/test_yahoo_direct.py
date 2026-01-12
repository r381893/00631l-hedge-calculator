import requests
import pandas as pd
from datetime import datetime
import time

def test_yahoo_direct():
    symbol = "^TWII"
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=3mo&interval=1d"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    print(f"Fetching {url}...")
    try:
        response = requests.get(url, headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if "chart" in data and "result" in data["chart"]:
                result = data["chart"]["result"][0]
                timestamps = result["timestamp"]
                quote = result["indicators"]["quote"][0]
                close = quote["close"]
                
                df = pd.DataFrame({
                    "Date": [datetime.fromtimestamp(ts) for ts in timestamps],
                    "Close": close
                })
                print(f"✅ Success! Retrieved {len(df)} rows.")
                print(df.head())
            else:
                print("❌ Invalid JSON structure")
        else:
            print(f"❌ Failed: {response.text[:200]}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    test_yahoo_direct()
