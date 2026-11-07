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

:: 尝试结束可能占用 app.exe 的残留进程（编译输出目录）
echo [信息] 正在检查并尝试结束残留的 app.exe 进程...
taskkill /F /IM app.exe >nul 2>nul
echo.

:: 执行 Tauri 编译命令
call tauri build

:: 如果编译失败，跳转到错误处理标签
if errorlevel 1 goto BUILD_ERROR

:: ===================================================
:: 编译成功：复制 exe 到目标目录
:: ===================================================
set "SRC_EXE=%~dp0src-tauri\target\release\app.exe"
set "DEST_DIR=D:\software\markdown looker"
set "DEST_EXE=%DEST_DIR%\app.exe"

echo.
echo ===================================================
echo [信息] 开始复制 exe 到目标目录...
echo 源文件: %SRC_EXE%
echo 目标目录: %DEST_DIR%
echo ===================================================

:: 检查源文件是否存在
if not exist "%SRC_EXE%" (
    echo.
    echo [警告] 未找到编译输出：%SRC_EXE%
    echo 请检查是否编译成功。
    goto COPY_END
)

:: 确保目标目录存在（不存在则创建）
if not exist "%DEST_DIR%" (
    echo [信息] 目标目录不存在，正在创建...
    mkdir "%DEST_DIR%" >nul 2>nul
    if not exist "%DEST_DIR%" (
        echo.
        echo [错误] 无法创建目标目录：%DEST_DIR%
        echo 请检查权限或磁盘是否存在。
        goto COPY_END
    )
)

:: 复制前先结束目标目录可能正在运行的旧进程（避免文件被占用）
taskkill /F /IM app.exe >nul 2>nul

:: 执行复制（先删除旧文件，避免被占用时残留）
if exist "%DEST_EXE%" (
    del /F /Q "%DEST_EXE%" >nul 2>nul
)

copy /Y "%SRC_EXE%" "%DEST_EXE%" >nul
if errorlevel 1 (
    echo.
    echo [错误] 复制失败！
    echo 可能原因：目标 exe 正在运行，或没有写入权限。
    echo 请关闭 D:\software\markdown looker\app.exe 后重试。
    goto COPY_END
)

echo [成功] 已复制到：%DEST_EXE%

:COPY_END
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
echo 如果提示"拒绝访问"，请检查是否有杀毒软件或其他程序占用了 app.exe 文件。
echo ===================================================
pause
exit /b 1