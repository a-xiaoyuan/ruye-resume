@echo off
rem 一键启动如页本地开发环境：后端 8080 + 前端 127.0.0.1:5173（前端通过同源代理访问后端）
rem 两个服务各开一个窗口，关掉窗口就停止对应服务
chcp 65001 >nul
cd /d "%~dp0.."
start "如页 后端 8080" cmd /k "cd /d server && mvn -q spring-boot:run"
start "如页 前端 5173" cmd /k "cd /d apps\web && set VITE_RUYE_API=/ && node node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173 --strictPort --open"
