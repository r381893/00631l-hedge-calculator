import json

try:
    with open('serviceAccountKey.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("\n请复制下方 [firebase] 到结束的所有内容 (包含中括号):\n")
    print("```toml")
    print("[firebase]")
    for key, value in data.items():
        # TOML string escaping: basic JSON dumps usually works well for TOML strings too
        # but we need to ensure it's a valid TOML string.
        # json.dumps will add quotes and escape \n, which is what we want.
        print(f'{key} = {json.dumps(value)}')
    print("```\n")

except FileNotFoundError:
    print("找不到 serviceAccountKey.json，請確認檔案在當前目錄下。")
except Exception as e:
    print(f"發生錯誤: {e}")
