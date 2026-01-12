import config
import os

# Path from user's screenshot
correct_cert_path = r"C:\CAFubon\R122579036\R122579036.pfx"

print(f"Updating Production Cert Path to: {correct_cert_path}")

# Load current settings to preserve them
user_id = config.FUBON_PRODUCTION_USER_ID
password = config.FUBON_PRODUCTION_PASSWORD
cert_password = config.FUBON_PRODUCTION_CERT_PASSWORD
tg_token = config.TELEGRAM_BOT_TOKEN
tg_chat_id = config.TELEGRAM_CHAT_ID

# Save with new path
success, msg = config.save_settings_to_env(
    user_id=user_id,
    password=password,
    cert_path=correct_cert_path,
    cert_password=cert_password,
    telegram_token=tg_token,
    telegram_chat_id=tg_chat_id,
    env_mode="PROD"
)

print(f"Update Result: {success} - {msg}")

# Verify
import importlib
importlib.reload(config)
print(f"New Prod Cert Path in Config: {config.FUBON_PRODUCTION_CERT_PATH}")
