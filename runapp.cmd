@echo off
setlocal
pushd "%~dp0"
node scripts\runapp.mjs %*
set "exitCode=%ERRORLEVEL%"
popd
exit /b %exitCode%
