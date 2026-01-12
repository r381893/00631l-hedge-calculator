# 期權數據系統部署與協作指南 (Windows & Mac 跨裝置同步)

本指南說明如何在多台電腦 (Windows/Mac) 上部署您的期權監控系統，並確保數據透過 **Firebase Firestore** 實現連貫性。

## Part A: 雲端設定 - Firebase Firestore (一次性設定)

**目的**：建立雲端資料庫，讓 Windows 和 Mac 可以存取同一個數據源。

### 步驟 A.1: 準備 Firebase 服務帳號金鑰
1.  **前往 Firebase Console**：登入您的 Google 帳戶並前往 [Firebase Console](https://console.firebase.google.com/)。
2.  **建立專案**：如果您還沒有專案，請建立一個。
3.  **產生金鑰**：
    *   點擊左上角「⚙️ 專案設定」(Project Settings)。
    *   切換到「服務帳號」(Service accounts) 標籤。
    *   點擊「產生新的私密金鑰」(Generate new private key)。
4.  **儲存金鑰檔案**：
    *   下載 JSON 檔案。
    *   **重新命名為 `serviceAccountKey.json`**。
    *   **放置位置**：將此檔案放入專案的根目錄 (與 `app.py` 同一層)。

### 步驟 A.2: 設定 Firestore 資料庫
1.  **建立資料庫**：
    *   在 Firebase Console 左側選單點擊「Build」->「Firestore Database」。
    *   點擊「Create database」。
    *   選擇位置 (建議選 `asia-east1` 台灣，或 `us-central1`)。
    *   選擇「**Start in production mode**」或「**Start in test mode**」。
2.  **設定安全規則 (Rules)**：
    *   切換到「Rules」標籤。
    *   為了開發方便，暫時使用以下規則 (允許擁有金鑰的後端讀寫)：
    ```javascript
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /{document=**} {
          allow read, write: if false; // 透過 Admin SDK (我們的 Python 程式) 存取時，這裡設 false 沒關係，因為 Admin SDK 擁有完全權限。
        }
      }
    }
    ```
    *   *注意：如果您是從前端 JS 直接呼叫，才需要設為 true。我們是用 Python Admin SDK，它是「超級管理員」，不受此規則限制，只要有 `serviceAccountKey.json` 即可。*

---

## Part B: 本地環境設定 (每台電腦都要做)

### 步驟 B.1: 取得程式碼與安裝套件
1.  **更新程式碼**：確保您的專案包含最新的 `firestore_db.py` 和更新後的 `app.py`。
2.  **安裝套件**：
    在終端機 (Terminal/CMD) 執行：
    ```bash
    pip install -r requirements.txt
    ```

### 步驟 B.2: 設定環境變數 (.env)
在專案根目錄建立或修改 `.env` 檔案，確保包含以下內容：

```ini
# --- 富邦 API 憑證資訊 ---
FUBON_USER_ID=您的身分證字號
FUBON_PASSWORD=您的登入密碼
FUBON_CERT_PASSWORD=您的憑證密碼
# 憑證路徑 (請依實際位置修改)
FUBON_CERT_PATH=./58581758.pfx

# --- Firebase 設定 ---
# 指向您的金鑰檔案
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json
# (選填) 如果程式碼有用到 Project ID
FIREBASE_PROJECT_ID=您的專案ID
```

---

## Part C: 執行與驗證

### 步驟 C.1: 啟動應用程式
```bash
streamlit run app.py
```

### 步驟 C.2: 驗證同步
1.  **Windows**：啟動程式，開始監控。
2.  **Firebase Console**：去網頁上看 Firestore Database，應該會看到一個 `monitoring_data` (或類似名稱) 的集合 (Collection)，裡面有新的文件 (Document) 產生。
3.  **Mac**：啟動程式，應該能自動載入並顯示剛剛 Windows 寫入的數據。
