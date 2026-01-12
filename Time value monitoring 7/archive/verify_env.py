import config
import os

print(f"OS Detected: {config.get_current_os()}")
print(f"Test Cert Path: {config.FUBON_TEST_CERT_PATH}")
print(f"Test Cert Exists: {os.path.exists(config.FUBON_TEST_CERT_PATH)}")
print(f"Prod Cert Path: {config.FUBON_PRODUCTION_CERT_PATH}")
print(f"Prod Cert Exists: {os.path.exists(config.FUBON_PRODUCTION_CERT_PATH)}")
