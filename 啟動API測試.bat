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

rem 自動安裝相依套件（若已安裝會略過）
echo 📥 正在檢查並安裝 Python 相依套件...
python -m pip install --upgrade pip >nul 2>&1
if exist requirements.txt (
	python -m pip install -r requirements.txt
) else (
	echo ⚠ 找不到 requirements.txt，跳過安裝
)

rem 自動找出可用埠（從 5000 開始，最多嘗試到 5010），若被占用嘗試殺掉該 PID
setlocal enabledelayedexpansion
set BASEPORT=5000
set PORT=%BASEPORT%
set MAXPORT=5010
:find_port
set PID=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%"') do set PID=%%a
if defined PID (
	echo ⚠ port %PORT% 被 PID %PID% 佔用，嘗試強制終止該程序...
	taskkill /PID %PID% /F >nul 2>&1
	if errorlevel 1 (
		echo ❌ 無法終止 PID %PID%，改嘗試下一個埠...
		set /a PORT+=1
		if %PORT% LEQ %MAXPORT% goto find_port
		echo ❌ 在可嘗試範圍內未找到可用埠，請手動檢查。
		pause
		exit /b 1
	) else (
		echo ✅ 已終止 PID %PID%，將使用埠 %PORT%
	)
)

echo 🚀 啟動應用程式於埠 %PORT%...
set PORT=%PORT%
python app.py

pause
