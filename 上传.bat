@echo off
chcp 65001 >nul
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 python 命令，请安装 Python 并加入 PATH。
    pause
    exit /b 1
)

python "%~dp0upload.py"
if errorlevel 1 (
    echo.
    echo [提示] 脚本异常退出，请查看上方输出。
    pause
)