@echo off
chcp 65001 >nul
echo ========================================
echo   00631L 避險計算器 - 前端版本
echo ========================================
echo.
cd /d "%~dp0"
echo 正在啟動本地伺服器...
echo 請在瀏覽器中開啟: http://localhost:8080
echo.
echo 按 Ctrl+C 停止伺服器
echo.
python -m http.server 8080
pause
