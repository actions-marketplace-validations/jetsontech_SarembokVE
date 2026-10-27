@echo off
TITLE SAREMBOK VE - Multi-Agent Voice Orchestrator Gateway [DEPRECATED]
color 0E
echo ==============================================================================
echo [DEPRECATED] start_voice_engine.bat is deprecated in SarembokVE 0.3.0+.
echo Please use the cross-platform CLI:
echo     node bin/sarembok-cli.js engine voice
echo or
echo     npx sarembok engine voice
echo ==============================================================================
echo.
echo Launching unified voice orchestrator via node bin\sarembok-cli.js engine voice...
node bin\sarembok-cli.js engine voice
pause
