@echo off
TITLE SAREMBOK VE - Voice Engine Host [DEPRECATED]
color 0E
echo ==============================================================================
echo [DEPRECATED] start_jarvis.bat is deprecated in SarembokVE 0.3.0+.
echo Please use the cross-platform CLI:
echo     node bin/sarembok-cli.js engine start
echo or
echo     npx sarembok engine start
echo ==============================================================================
echo.
echo Launching unified engine via node bin\sarembok-cli.js engine start...
node bin\sarembok-cli.js engine start
pause