@echo off
rem The `sp` command, run by Sprue's own runtime: no Node.js install needed.
setlocal
set "SPRUE_CLI_LAUNCHER=%~dp0sp.cmd"
set ELECTRON_RUN_AS_NODE=1
"%~dp0..\..\Sprue.exe" "%~dp0..\app.asar\dist\cli.mjs" %*
endlocal
