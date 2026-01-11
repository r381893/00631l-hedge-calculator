@echo off
chcp 65001 >nul
echo ====================================
echo 🚀 啟動選擇權報價 API (測試環境)
echo ====================================

cd /d "%~dp0api"

rem 設定由 .env 檔案統一管理
rem 請確保 api\.env 檔案已正確設定

echo.
echo 📌 測試環境說明:
echo    設定檔: api\.env
echo    開盤時間: 09:30~19:00
echo    非開盤時間將自動使用 Mock 資料
echo.
echo 📡 啟動 API 伺服器...
echo    端點: http://localhost:5000/api/health
echo          http://localhost:5000/api/option-price?strike=22000^&type=call
echo.

python app.py

pause
