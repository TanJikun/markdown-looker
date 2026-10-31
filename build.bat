@echo off
chcp 65001 >nul
title Markdown Looker 一键编译

:: 切换到脚本所在的当前目录
cd /d "%~dp0"

echo ===================================================
echo 正在准备编译 Markdown Looker...
echo 提示：由于之前已经编译过依赖，本次编译预计只需几秒到十几秒。
echo ===================================================
echo.

:: 尝试结束可能占用 app.exe 的残留进程
echo [信息] 正在检查并尝试结束残留的 app.exe 进程...
taskkill /F /IM app.exe >nul 2>nul
echo.

:: 执行 Tauri 编译命令
call tauri build

:: 如果编译失败，跳转到错误处理标签
if errorlevel 1 goto BUILD_ERROR

:: 编译成功
echo.
echo ===================================================
echo [成功] 编译完成！
echo ===================================================
echo.
echo 编译已全部结束。
pause
exit /b 0

:BUILD_ERROR
echo.
echo ===================================================
echo [错误] 编译失败！
echo 请检查上方是否有红色的报错信息 [如代码修改有误]。
echo 如果提示“拒绝访问”，请检查是否有杀毒软件或其他程序占用了 app.exe 文件。
echo ===================================================
pause
exit /b 1