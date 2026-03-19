@echo off
chcp 65001 >nul
echo ========================================
echo GyAI 工业智能助手
echo ========================================
echo.

cd /d "%~dp0BackEnd"

echo 正在启动后端服务...
echo 服务地址: http://127.0.0.1:5000
echo 主页面: http://127.0.0.1:5000/
echo 对话页面: http://127.0.0.1:5000/chat
echo.
echo 按 Ctrl+C 停止服务
echo ========================================

python app.py
pause
