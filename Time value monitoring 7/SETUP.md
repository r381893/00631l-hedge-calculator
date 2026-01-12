# 專案設定指南 (Project Setup Guide)

本指南說明如何在不同電腦 (Windows/Mac) 上設定此專案，並確保憑證安全。

## 1. 取得程式碼
從 GitHub 下載或 Clone 此專案：
```bash
git clone <YOUR_GITHUB_REPO_URL>
cd op-put
```

## 2. 準備憑證檔案 (重要！)
由於安全考量，**憑證檔案與密碼不會上傳到 GitHub**。您需要在每一台電腦上「手動」放入這些檔案。

### 步驟：
1.  **複製憑證**：將您的憑證檔案 (例如 `58581758.pfx`) 複製到專案根目錄 (與 `app.py` 同一層)。
2.  **設定環境變數**：
    - 複製 `.env.example` 並重新命名為 `.env`。
    - 用文字編輯器打開 `.env`，填入您的帳號資訊：
    ```ini
    FUBON_USER_ID=您的身分證字號
    FUBON_PASSWORD=您的登入密碼
    FUBON_CERT_PASSWORD=您的憑證密碼
    # 如果憑證檔名不同，請修改下面這行
    FUBON_CERT_PATH=./58581758.pfx
    ```

## 3. 設定 Google Sheets 同步 (選用)
如果您希望在不同電腦間同步監控數據，請依照以下步驟設定：

1.  **建立 Google Cloud 專案**：
    - 前往 [Google Cloud Console](https://console.cloud.google.com/)。
    - 建立一個新專案。
    - 啟用 API：搜尋並啟用 "Google Sheets API" 和 "Google Drive API"。
2.  **建立服務帳號 (Service Account)**：
    - 在 "Credentials" (憑證) 頁面，點擊 "Create Credentials" -> "Service Account"。
    - 建立後，進入該服務帳號，點擊 "Keys" (金鑰) -> "Add Key" -> "Create new key" -> 選擇 "JSON"。
    - 下載該 JSON 檔案，**重新命名為 `credentials.json`**，並放入專案根目錄。
3.  **分享權限**：
    - 打開 `credentials.json`，找到 `"client_email"` 欄位 (例如 `xxx@project-id.iam.gserviceaccount.com`)。
    - 去您的 Google Drive，建立一個新的 Google Sheet，命名為 `OptionMonitorData` (或您喜歡的名字)。
    - 點擊右上角 "Share" (共用)，將剛剛的 email 貼上，給予 "Editor" (編輯者) 權限。

完成後，程式啟動時就會自動連接並同步數據。

## 4. 安裝套件
在終端機 (Terminal/Command Prompt) 執行：
```bash
pip install -r requirements.txt
```

## 5. 執行程式
### Windows
點擊 `start_monitor.bat` 或執行：
```bash
streamlit run app.py
```

### Mac
在終端機執行：
```bash
streamlit run app.py
```
