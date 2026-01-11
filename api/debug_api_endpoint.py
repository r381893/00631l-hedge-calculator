import requests
import threading
import time
import sys
import io
import json

# Configure stdout
if sys.stdout and hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from app import app

def run_server():
    app.run(host='127.0.0.1', port=5001, debug=False, use_reloader=False)

def test_endpoint():
    # Wait for server to start
    time.sleep(2)
    
    url = "http://127.0.0.1:5001/api/option-chain?source=taifex&center=23000"
    print(f"Testing URL: {url}")
    
    try:
        response = requests.get(url, timeout=5)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Response keys:", data.keys())
            print(f"Source: {data.get('source')}")
            
            chain = data.get('chain', [])
            print(f"Chain length: {len(chain)}")
            
            if len(chain) > 0:
                print("First item in chain:")
                print(json.dumps(chain[0], indent=2, ensure_ascii=False))
                
                # Check for valid prices
                valid_prices = [item for item in chain if item['call'] and item['call'].get('price', 0) > 0]
                print(f"Items with valid Call prices: {len(valid_prices)}")
                
                if len(valid_prices) > 0:
                     print("✅ API Verification SUCCESS: Data returned")
                else:
                     print("⚠️ API Verification WARNING: No valid prices found (might be market closed or holiday, or parsing issue)")
            else:
                print("❌ API Verification FAILED: Empty chain")
        else:
            print(f"❌ API Verification FAILED: Status {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Exception: {e}")
    finally:
        # We can't easily kill the flask thread, but the script will exit
        pass

if __name__ == "__main__":
    t = threading.Thread(target=run_server, daemon=True)
    t.start()
    test_endpoint()
