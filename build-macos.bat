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
    echo [错误] 未找到 GitHub CLI - gh。
    echo   安装: https://cli.github.com/
    echo   登录: gh auth login
    goto :END
)

:: 获取当前仓库 owner/name
for /f "delims=" %%i in ('gh repo view --json nameWithOwner --jq .nameWithOwner 2^>nul') do set "REPO=%%i"
if "!REPO!"=="" (
    echo [错误] 无法识别当前目录对应的 GitHub 仓库。
    echo   请确保在 git 仓库中运行，且 gh 已登录。
    goto :END
)
echo 仓库: !REPO!

:: 触发 workflow
echo [信息] 触发 Build macOS workflow...
gh workflow run build-macos.yml --repo !REPO!
if errorlevel 1 (
    echo [错误] 触发失败。请检查 .github/workflows/build-macos.yml 是否存在。
    goto :END
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
    goto :END
)
echo 运行 ID: !RUN_ID!

:: 等待完成
echo [信息] 等待构建完成（按 Ctrl+C 可中断）...
gh run watch !RUN_ID! --repo !REPO! --exit-status
if errorlevel 1 (
    echo [错误] 构建失败或已取消。请到 Actions 页面查看日志。
    goto :END
)

:: 构建成功，生成链接并打开浏览器
set "RUN_URL=https://github.com/!REPO!/actions/runs/!RUN_ID!"

echo.
echo ===================================================
echo [成功] 构建已完成！
echo ===================================================
echo 构建链接: !RUN_URL!
echo.
echo [信息] 正在自动打开浏览器...
start "" "!RUN_URL!"

echo.
echo 👉 请在弹出的网页中向下滚动到底部的「Artifacts」区域。
echo 👉 点击 `markdown-looker-macos-adhoc` 下载压缩包，解压后即可获得 .dmg 文件。
echo 首次打开提示「无法验证开发者」时，按 README 的「macOS 首次打开」放行。

:END
echo.
echo 按 Enter 键退出...
pause >nul
exit /b