@echo off
cd /d "%~dp0"
set /p msg=请输入本次更改内容: 
if "%msg%"=="" set msg=-
git add .
git commit -m "%msg%"
git push -u https://github.com/TanJikun/markdown-looker.git main --force