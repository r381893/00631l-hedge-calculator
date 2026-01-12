@echo off
:: 設定編碼為 UTF-8 以顯示中文
chcp 65001 >nul
title 00631L 避險計算器 - 整合啟動腳本

echo ========================================================
echo 正在檢查並安裝必要套件...
echo ========================================================

:: 0. 安裝 Python 依賴
if exist "api\requirements.txt" (
    echo [安裝依賴] 正在安裝必要套件 (Flask, 等)...
    pip install -r api\requirements.txt
)

echo.
echo ========================================================
echo 正在啟動所有服務 (前端 + 後端)...
echo 1. 前端網頁: http://localhost:8000
echo 2. 後端 API: http://localhost:5000
echo ========================================================

:: 1. 啟動後端 API (Flask)
if exist "api\app.py" (
    echo [啟動後端] 正在啟動 API 伺服器 (Port 5000)...
    :: 使用 start 開啟新視窗執行，避免卡住
    start "Backend API Server" cmd /k "cd api && python app.py"
) else (
    echo [錯誤] 找不到 api\app.py，無法啟動數據服務！
    echo 請確認您的資料夾結構是否完整。
    pause
    exit
)

:: 等待 5 秒讓後端先跑起來
timeout /t 5 >nul

:: 2. 啟動前端 Server (Python simple http)
echo [啟動前端] 正在啟動網頁伺服器 (Port 8000)...
start "Frontend Web Server" cmd /k "python -m http.server 8000"

:: 3. 自動開啟瀏覽器
echo [完成] 正在開啟瀏覽器...
start http://localhost:8000

echo.
echo ========================================================
echo ✅ 服務已全部啟動！
echo ⚠️  請注意：會彈出兩個黑色視窗 (Backend & Frontend)，請勿關閉它們！
echo ========================================================
pause
