@echo off
cd /d "%~dp0"
git add .
git commit -m "-"
git push -u https://github.com/TanJikun/markdown-looker.git main --force