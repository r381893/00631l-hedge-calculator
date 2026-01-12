# 富邦 API 設定指南

## 步驟一：安裝 SDK

在 Mac 上執行：
```bash
pip install fubon-neo
```

## 步驟二：取得憑證

1. 下載 CATool 並申請憑證
2. 憑證會儲存在 `C:/CAFubon/YOUR_ID.pfx`（Windows）
3. Mac 上路徑可能是 `/Users/YOUR_NAME/CAFubon/YOUR_ID.pfx`

## 步驟三：填寫 config.py

開啟 `config.py`，填入：
```python
FUBON_USER_ID = "您的身分證字號"
FUBON_PASSWORD = "12345678"  # 測試環境密碼
FUBON_CERT_PATH = "/Users/YOUR_NAME/CAFubon/YOUR_ID.pfx"  # Mac 路徑
FUBON_CERT_PASSWORD = "您的憑證密碼"
```

## 步驟四：切換數據源

1. 執行 `streamlit run app.py`
2. 在左側選擇「📡 數據來源」
3. 選擇「富邦API (Fubon)」

## 測試環境資訊

- **測試時間**：9:30-19:00
- **測試密碼**：12345678
- **API URL**：已自動設定為測試環境

## 注意事項

⚠️ **重要**：
1. 富邦 API 的實際方法名稱可能與文件不同
2. 選擇權商品代碼格式需要確認
3. 建議先在測試環境測試
4. 如遇到問題，請參考富邦官方文件或聯繫客服

## 常見問題

**Q: Mac 上憑證路徑在哪？**
A: 通常在 `/Users/您的用戶名/CAFubon/`

**Q: 登入失敗怎麼辦？**
A: 檢查憑證路徑、密碼是否正確，確認在測試時間內（9:30-19:00）

**Q: 如何確認 API 是否正常？**
A: 程式會顯示「✅ Fubon API 登入成功」或錯誤訊息
