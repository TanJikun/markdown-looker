@echo off
setlocal

set "NEW_VERSION=%~1"

if "%NEW_VERSION%"=="" set /p NEW_VERSION=请输入新的版本号，例如 1.2.0 : 

if "%NEW_VERSION%"=="" (
    echo.
    echo 错误：版本号不能为空！
    goto :done
)

:: 改为调用 .cjs 文件
node "%~dp0update-version.cjs" %NEW_VERSION%

echo.
echo 别忘了重新打包以更新最终产物版本。

:done
echo.
pause
endlocal