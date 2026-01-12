import os
from dotenv import load_dotenv
from fubon_neo.sdk import FubonSDK

load_dotenv()

user_id = os.getenv("FUBON_USER_ID")
password = os.getenv("FUBON_PASSWORD")
cert_path = os.getenv("FUBON_CERT_PATH")
cert_password = os.getenv("FUBON_CERT_PASSWORD")

print(f"User ID: {user_id}")
# print(f"Password: {password}") 
print(f"Cert Path: {cert_path}")

try:
    sdk = FubonSDK()
    res = sdk.login(user_id, password, cert_path, cert_password)
    if res.is_success:
        print("✅ Login Success")
        
        print("\n--- Inspecting marketdata.rest_client ---")
        print(dir(sdk.marketdata.rest_client))
        
        if hasattr(sdk.marketdata.rest_client, 'stock'):
            print("\n--- Inspecting marketdata.rest_client.stock ---")
            print(dir(sdk.marketdata.rest_client.stock))
            
            if hasattr(sdk.marketdata.rest_client.stock, 'historical'):
                 print("\n--- Inspecting marketdata.rest_client.stock.historical ---")
                 print(dir(sdk.marketdata.rest_client.stock.historical))
            
            if hasattr(sdk.marketdata.rest_client.stock, 'intraday'):
                 print("\n--- Inspecting marketdata.rest_client.stock.intraday ---")
                 print(dir(sdk.marketdata.rest_client.stock.intraday))

        if hasattr(sdk.marketdata.rest_client, 'futopt'):
             print("\n--- Inspecting marketdata.rest_client.futopt ---")
             print(dir(sdk.marketdata.rest_client.futopt))

    else:
        print(f"Login Failed: {res.message}")
except Exception as e:
    print(f"Error: {e}")
