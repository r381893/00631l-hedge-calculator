import os
from dotenv import load_dotenv
import sys

# Force output to utf-8 environment
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv()

user_id = os.getenv('FUBON_USER_ID')
password = os.getenv('FUBON_PASSWORD')
cert_path = os.getenv('FUBON_CERT_PATH')
cert_password = os.getenv('FUBON_CERT_PASSWORD')
api_url = os.getenv('FUBON_API_URL')

print(f"UID: {user_id}")
print(f"Cert Path: {cert_path}")
print(f"API URL: {api_url}")

if not os.path.exists(cert_path):
    print(f"Error: Cert file not found at {cert_path}")
    # Try absolute path resolution
    abs_path = os.path.abspath(cert_path)
    print(f"Abs path: {abs_path}")
    if os.path.exists(abs_path):
        print("Found via abspath, updating cert_path...")
        cert_path = abs_path
    else:
        # Try joining with current dir
        cwd_path = os.path.join(os.getcwd(), cert_path)
        print(f"CWD joined path: {cwd_path}")
        if os.path.exists(cwd_path):
             cert_path = cwd_path

try:
    from fubon_neo.sdk import FubonSDK
    print("fubon-neo imported successfully.")
    
    sdk = FubonSDK(url=api_url) if api_url else FubonSDK()
    print("SDK initialized. Attempting login...")
    
    response = sdk.login(user_id, password, cert_path, cert_password)
    print(f"Login Response: {response}")
    
    if hasattr(response, 'is_success') and response.is_success:
        print("Login SUCCESS!")
    else:
        print("Login FAILED!")
        if hasattr(response, 'message'):
            print(f"Message: {response.message}")
            
except ImportError:
    print("Error: fubon-neo package not found.")
except Exception as e:
    print(f"Exception during login: {e}")
