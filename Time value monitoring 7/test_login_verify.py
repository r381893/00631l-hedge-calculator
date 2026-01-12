import sys
import os
import time

# 設定路徑以便載入模組
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from data_provider import FubonDataProvider
import config

print("========================================")
print("測試 FubonDataProvider 登入")
print("========================================")

# 嘗試使用 config 中的設定登入
print(f"使用憑證路徑: {config.FUBON_TEST_CERT_PATH}")
print(f"憑證是否存在: {os.path.exists(config.FUBON_TEST_CERT_PATH)}")
print(f"使用 URL: {config.FUBON_TEST_API_URL}")
print(f"使用帳號: {config.FUBON_TEST_USER_ID}")

# 隱藏密碼
masked_pwd = "*" * len(config.FUBON_TEST_PASSWORD) if config.FUBON_TEST_PASSWORD else "None"
masked_cert_pwd = "*" * len(config.FUBON_TEST_CERT_PASSWORD) if config.FUBON_TEST_CERT_PASSWORD else "None"
print(f"密碼長度: {len(config.FUBON_TEST_PASSWORD)}")
print(f"憑證密碼長度: {len(config.FUBON_TEST_CERT_PASSWORD)}")

try:
    provider = FubonDataProvider(
        user_id=config.FUBON_TEST_USER_ID,
        password=config.FUBON_TEST_PASSWORD,
        cert_path=config.FUBON_TEST_CERT_PATH,
        cert_password=config.FUBON_TEST_CERT_PASSWORD,
        api_url=config.FUBON_TEST_API_URL
    )
    
    if provider.is_logged_in:
        print("✅ 登入成功！")
        
        # 嘗試取得報價
        price = provider.get_option_price(22000, 'call')
        print(f"取得測試報價: {price}")
        
    else:
        print(f"❌ 登入失敗: {provider.login_error_message}")

except Exception as e:
    print(f"❌ 發生例外錯誤: {e}")
