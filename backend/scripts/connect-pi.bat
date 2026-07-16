@echo off
REM Raspberry Pi Connection Script - Tailscale First, Then Local LAN

setlocal enabledelayedexpansion

REM Connection targets
set TAILSCALE_IP=100.87.110.77
set LOCAL_IP=192.168.1.35
set SSH_USER=lucas

echo.
echo ========================================
echo  Raspberry Pi Connection Flow
echo ========================================
echo.

REM Try Tailscale first
echo Attempting Tailscale connection...
echo.
ping -n 1 %TAILSCALE_IP% >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Tailscale IP is reachable (%TAILSCALE_IP%)
    echo Launching SSH session...
    echo.
    ssh %SSH_USER%@%TAILSCALE_IP%
    goto end
) else (
    echo [FAILED] Tailscale IP unreachable (%TAILSCALE_IP%)
    echo.
)

REM Tailscale failed, try local LAN
echo Attempting local LAN connection...
echo.
ping -n 1 %LOCAL_IP% >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Local IP is reachable (%LOCAL_IP%)
    echo Launching SSH session...
    echo.
    ssh %SSH_USER%@%LOCAL_IP%
    goto end
) else (
    echo [FAILED] Local IP unreachable (%LOCAL_IP%)
    echo.
)

REM Both methods failed
echo ========================================
echo  ERROR: Both connection methods failed
echo ========================================
echo.
echo - Tailscale: %TAILSCALE_IP% (unreachable)
echo - Local LAN: %LOCAL_IP% (unreachable)
echo.
echo Please check:
echo   1. Raspberry Pi is powered on
echo   2. Network connectivity (Tailscale or local LAN)
echo   3. SSH is enabled on Raspberry Pi
echo.

:end
pause
