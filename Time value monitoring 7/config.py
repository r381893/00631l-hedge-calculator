# Config for Taiwan Option Monitor

# Data Source Selection
DATA_SOURCE = "MOCK"  # Options: "MOCK" or "FUBON"

import os

# Base directory of the project
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load .env manually to avoid dependencies
env_path = os.path.join(BASE_DIR, '.env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# Fubon API Credentials
# Fubon API Credentials (Test)
FUBON_TEST_USER_ID = os.getenv("FUBON_TEST_USER_ID", "")
FUBON_TEST_PASSWORD = os.getenv("FUBON_TEST_PASSWORD", "")
FUBON_TEST_CERT_PATH = os.getenv("FUBON_TEST_CERT_PATH", os.path.join(BASE_DIR, "58581758.pfx"))
FUBON_TEST_CERT_PASSWORD = os.getenv("FUBON_TEST_CERT_PASSWORD", "")

# Fubon API Credentials (Production)

FUBON_PRODUCTION_USER_ID = os.getenv("FUBON_PRODUCTION_USER_ID", "")
FUBON_PRODUCTION_PASSWORD = os.getenv("FUBON_PRODUCTION_PASSWORD", "")
FUBON_PRODUCTION_CERT_PATH = os.getenv("FUBON_PRODUCTION_CERT_PATH", os.path.join(BASE_DIR, "58581758.pfx"))
FUBON_PRODUCTION_CERT_PASSWORD = os.getenv("FUBON_PRODUCTION_CERT_PASSWORD", "")

# OS-Specific Cert Paths (Optional Overrides)
FUBON_CERT_PATH_MAC = os.getenv("FUBON_CERT_PATH_MAC", "")
FUBON_CERT_PATH_WIN = os.getenv("FUBON_CERT_PATH_WIN", "")

# Telegram Notification
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# API URLs
FUBON_TEST_API_URL = "wss://neoapitest.fbs.com.tw/TASP/XCPXWS"
FUBON_PRODUCTION_API_URL = "wss://neoapi.fbs.com.tw/TASP/XCPXWS"

# Monitor Settings
DEFAULT_THRESHOLD = 20.0

# Risk Management
RISK_MIN_LEVEL = float(os.getenv("RISK_MIN_LEVEL", "300.0"))
RISK_MARGIN_PER_CONTRACT = float(os.getenv("RISK_MARGIN_PER_CONTRACT", "12250.0"))
RISK_MANUAL_EQUITY = float(os.getenv("RISK_MANUAL_EQUITY", "500000.0"))
DEFAULT_INTERVAL_SECONDS = 10
DEFAULT_PROFIT_TARGET = 5.0

# --- Cross-Platform & Persistence Helpers ---
import platform

def get_current_os():
    system = platform.system()
    if system == "Windows":
        return "Windows"
    elif system == "Darwin":
        return "Mac"
    else:
        return "Linux"

def get_default_cert_path():
    os_type = get_current_os()
    
    if os_type == "Windows":
        # Check for Windows-specific override
        if FUBON_CERT_PATH_WIN:
            return FUBON_CERT_PATH_WIN
        return os.path.join(BASE_DIR, "58581758.pfx")
    else:
        # Check for Mac-specific override
        if FUBON_CERT_PATH_MAC:
            return FUBON_CERT_PATH_MAC
        # Mac usually needs absolute path or specific location
        return os.path.join(BASE_DIR, "58581758.pfx")

def save_settings_to_env(user_id, password, cert_path, cert_password, telegram_token="", telegram_chat_id="", env_mode="TEST", 
                         risk_min=None, risk_margin=None, risk_equity=None):
    """Save credentials and settings to .env file"""
    lines = []
    # Read existing
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    
    # Determine prefix based on env_mode
    prefix = "FUBON_TEST" if env_mode == "TEST" else "FUBON_PRODUCTION"
    
    # Helper to update or append
    new_lines = []
    keys_updated = set()
    
    updates = {
        f"{prefix}_USER_ID": user_id,
        f"{prefix}_PASSWORD": password,
        f"{prefix}_CERT_PATH": cert_path,
        f"{prefix}_CERT_PASSWORD": cert_password,
        "TELEGRAM_BOT_TOKEN": telegram_token,
        "TELEGRAM_CHAT_ID": telegram_chat_id
    }
    
    # Add Risk Params if provided
    if risk_min is not None: updates["RISK_MIN_LEVEL"] = str(risk_min)
    if risk_margin is not None: updates["RISK_MARGIN_PER_CONTRACT"] = str(risk_margin)
    if risk_equity is not None: updates["RISK_MANUAL_EQUITY"] = str(risk_equity)
    
    for line in lines:
        key_found = False
        for key, value in updates.items():
            if line.strip().startswith(f"{key}="):
                new_lines.append(f"{key}={value}\n")
                keys_updated.add(key)
                key_found = True
                break
        if not key_found:
            new_lines.append(line)
            
    # Append missing keys
    for key, value in updates.items():
        if key not in keys_updated:
            # Add a newline if previous line didn't have one
            if new_lines and not new_lines[-1].endswith('\n'):
                new_lines.append('\n')
            new_lines.append(f"{key}={value}\n")
            
    try:
        with open(env_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        
        # Update current process env vars too
        for key, value in updates.items():
            os.environ[key] = value
            
        return True, "設定已儲存 (Settings Saved)"
    except Exception as e:
        return False, str(e)
            
        return True, f"設定已儲存至 .env ({env_mode})"
    except Exception as e:
        return False, f"儲存失敗: {str(e)}"
