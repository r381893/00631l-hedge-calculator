import config
from data_provider import FubonDataProvider
import sys
import time
import json

# Force stdout to utf-8
sys.stdout.reconfigure(encoding='utf-8')

print("--- Starting Order Diagnosis ---")

# Load Test Credentials
USER_ID = config.FUBON_TEST_USER_ID
PASSWORD = config.FUBON_TEST_PASSWORD
CERT_PATH = config.FUBON_TEST_CERT_PATH
CERT_PASSWORD = config.FUBON_TEST_CERT_PASSWORD
API_URL = config.FUBON_TEST_API_URL

print(f"User ID: {USER_ID}")

try:
    provider = FubonDataProvider(
        user_id=USER_ID,
        password=PASSWORD,
        cert_path=CERT_PATH,
        cert_password=CERT_PASSWORD,
        api_url=API_URL
    )
    
    if not provider.is_logged_in:
        print(f"❌ Login Failed: {provider.login_error_message}")
        sys.exit(1)
    print("✅ Login Successful")
    time.sleep(1)

    print("\n--- Fetching Orders ---")
    if hasattr(provider, 'accounts') and provider.accounts:
        for acc in provider.accounts:
            if acc.account_type == "futopt":
                print(f"Account: {acc.account}")
                orders_result = provider.api.futopt.get_order_results(acc)
                
                if orders_result and orders_result.is_success and orders_result.data:
                    print(f"Raw Data Count: {len(orders_result.data)}")
                    for i, order in enumerate(orders_result.data):
                        print(f"\nOrder #{i+1}:")
                        # Try to print all attributes
                        for attr in dir(order):
                            if not attr.startswith('_'):
                                try:
                                    val = getattr(order, attr)
                                    print(f"  {attr}: {val}")
                                except:
                                    pass
                else:
                    print("No orders found or request failed.")
                    if orders_result:
                        print(f"Message: {orders_result.message}")

    print("\n--- Diagnosis Complete ---")

except BaseException as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
