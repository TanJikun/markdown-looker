@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Markdown Looker - 构建 macOS 版本

cd /d "%~dp0"

echo ===================================================
echo 正在触发 GitHub Actions 构建 macOS 版本...
echo ===================================================
echo.

:: 检查 GitHub CLI
where gh >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 GitHub CLI (gh)。
    echo   安装: https://cli.github.com/
    echo   登录: gh auth login
    pause
    exit /b 1
)

:: 获取当前仓库 owner/name
for /f "delims=" %%i in ('gh repo view --json nameWithOwner --jq .nameWithOwner 2^>nul') do set "REPO=%%i"
if "!REPO!"=="" (
    echo [错误] 无法识别当前目录对应的 GitHub 仓库。
    echo   请确保在 git 仓库中运行，且 gh 已登录。
    pause
    exit /b 1
)
echo 仓库: !REPO!

:: 触发 workflow
echo [信息] 触发 Build macOS workflow...
gh workflow run build-macos.yml --repo !REPO!
if errorlevel 1 (
    echo [错误] 触发失败。请检查 .github/workflows/build-macos.yml 是否存在。
    pause
    exit /b 1
)

echo [信息] 等待 workflow 启动...
timeout /t 8 /nobreak >nul

:: 获取最新 run id（刚触发可能还没出现在列表，重试几次）
set "RUN_ID="
for /l %%n in (1,1,5) do (
    if "!RUN_ID!"=="" (
        for /f "delims=" %%i in ('gh run list --repo !REPO! --workflow build-macos.yml --limit 1 --json databaseId --jq ".[0].databaseId" 2^>nul') do set "RUN_ID=%%i"
        if "!RUN_ID!"=="" timeout /t 3 /nobreak >nul
    )
)
if "!RUN_ID!"=="" (
    echo [错误] 无法获取运行 ID。请到 Actions 页面手动查看。
    pause
    exit /b 1
)
echo 运行 ID: !RUN_ID!

:: 等待完成
echo [信息] 等待构建完成（按 Ctrl+C 可中断）...
gh run watch !RUN_ID! --repo !REPO! --exit-status
if errorlevel 1 (
    echo [错误] 构建失败或已取消。请到 Actions 页面查看日志。
    pause
    exit /b 1
)

:: 下载 artifact
set "TEMP_DIR=%TEMP%\ml-macos-%RANDOM%"
mkdir "!TEMP_DIR!" >nul 2>nul
echo [信息] 下载构建产物...
gh run download !RUN_ID! --repo !REPO! --dir "!TEMP_DIR!"
if errorlevel 1 (
    echo [错误] 下载失败。
    rmdir /S /Q "!TEMP_DIR!" >nul 2>nul
    pause
    exit /b 1
)

:: 复制 .dmg 到目标目录
set "DEST_DIR=D:\software\markdown looker\macOS"
if not exist "!DEST_DIR!" mkdir "!DEST_DIR!" >nul 2>nul

set "FOUND=0"
for /r "!TEMP_DIR!" %%f in (*.dmg) do (
    copy /Y "%%f" "!DEST_DIR!\" >nul
    echo [成功] 已复制: %%f
    set "FOUND=1"
)

rmdir /S /Q "!TEMP_DIR!" >nul 2>nul

if "!FOUND!"=="0" (
    echo [错误] 产物中未找到 .dmg 文件。
    pause
    exit /b 1
)

echo.
echo ===================================================
echo [成功] macOS .dmg 已保存到: !DEST_DIR!
echo ===================================================
echo 把该目录下的 .dmg 拷到 macOS 上双击安装即可。
echo 首次打开提示「无法验证开发者」时，按 README 的「macOS 首次打开」放行。
echo.
pause