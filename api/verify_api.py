import requests
import time
import sys

def test_endpoint(name, url):
    print(f"Testing {name}...", end=" ")
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            print(f"✅ OK ({response.status_code})")
            print(f"   Response: {response.json()}")
            return True, response.json()
        else:
            print(f"❌ Failed ({response.status_code})")
            print(f"   Response: {response.text}")
            return False, None
    except Exception as e:
        print(f"❌ Error: {e}")
        return False, None

def main():
    base_url = "http://localhost:5000/api"
    print(f"Waiting for API to start at {base_url}...")
    
    # Wait for server to be ready
    for i in range(10):
        try:
            requests.get(f"{base_url}/health", timeout=1)
            break
        except:
            time.sleep(1)
            print(".", end="", flush=True)
    print("\n")

    # 1. Health Check
    success, data = test_endpoint("Health Check", f"{base_url}/health")
    if not success:
        sys.exit(1)
    
    # 2. Check Available Sources
    success, data = test_endpoint("Available Sources", f"{base_url}/sources")
    if success:
        if 'fubon' in data.get('sources', []):
            print("   => Fubon source is AVAILABLE")
        else:
            print("   => Fubon source is NOT available (Check credentials/install)")

    # 3. Test Option Chain (Mock)
    test_endpoint("Option Chain (Mock)", f"{base_url}/option-chain?source=mock&center=23000")

    # 4. Test Option Chain (Fubon) - if available
    # We try it anyway to see the error or success
    test_endpoint("Option Chain (Fubon)", f"{base_url}/option-chain?source=fubon&center=23000")

if __name__ == "__main__":
    main()
