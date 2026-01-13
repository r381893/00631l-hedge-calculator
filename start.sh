#!/bin/bash

# 設定 UTF-8
export LANG=en_US.UTF-8

echo "========================================================"
echo "正在檢查並安裝必要套件..."
echo "========================================================"

# 0. 安裝 Python 依賴
if [ -f "api/requirements.txt" ]; then
    echo "[安裝依賴] 正在安裝必要套件..."
    pip3 install -r api/requirements.txt
fi

echo ""
echo "========================================================"
echo "正在啟動所有服務 (前端 + 後端)..."
echo "1. 前端網頁: http://localhost:8000"
echo "2. 後端 API: http://localhost:5000"
echo "========================================================"

# 1. 啟動後端 API (Flask)
if [ -f "api/app.py" ]; then
    echo "[啟動後端] 正在啟動 API 伺服器 Port 5000..."
    # 在背景執行
    cd api && python3 app.py > ../backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..
else
    echo "[錯誤] 找不到 api/app.py，無法啟動數據服務！"
    exit 1
fi

# 等待幾秒
sleep 3

# 2. 啟動前端 Server
echo "[啟動前端] 正在啟動網頁伺服器 (Port 8080)..."
python3 -m http.server 8080 > frontend.log 2>&1 &
FRONTEND_PID=$!

# 3. 自動開啟瀏覽器
echo "[完成] 正在開啟瀏覽器..."
sleep 2
open "http://localhost:8080"

echo ""
echo "========================================================"
echo "✅ 服務已全部啟動！"
echo "後端 PID: $BACKEND_PID"
echo "前端 PID: $FRONTEND_PID"
echo "若要停止服務，請關閉此終端機視窗，或按 Ctrl+C 並手動 kill process。"
echo "========================================================"

# 保持腳本執行，以便能夠捕捉 Ctrl+C 來清理 (簡單實作)
wait $BACKEND_PID $FRONTEND_PID
