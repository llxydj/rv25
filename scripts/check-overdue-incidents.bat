@echo off
REM Script to check for overdue incidents
REM This should be scheduled to run every minute

cd /d "%~dp0"
node check-overdue-incidents.ts