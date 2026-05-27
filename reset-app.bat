@echo off
echo ========================================
echo   FeesFoundry App Reset Script
echo ========================================
echo.
echo This will delete ALL data including:
echo   - School name, logo, address, phone, email
echo   - All students ^& guardians
echo   - All payment records ^& receipts
echo   - All fee structures ^& academic years
echo   - All user accounts
echo   - All activity logs
echo.

echo Stopping the application if running...
taskkill /F /IM electron.exe 2>nul
taskkill /F /IM node.exe 2>nul
echo.

echo Deleting database (contains all school data)...
if exist "school_fees.db" (
    del "school_fees.db"
    echo   - Deleted school_fees.db
) else (
    echo   - No database file found
)
echo.

echo Deleting local storage data...
if exist "%APPDATA%\FeesFoundry" (
    rmdir /S /Q "%APPDATA%\FeesFoundry"
    echo   - Deleted FeesFoundry app data
) else (
    echo   - No FeesFoundry folder found
)
if exist "%LOCALAPPDATA%\FeesFoundry" (
    rmdir /S /Q "%LOCALAPPDATA%\FeesFoundry"
    echo   - Deleted local FeesFoundry data
) else (
    echo   - No local FeesFoundry folder found
)
if exist "%APPDATA%\school-fees-manager" (
    rmdir /S /Q "%APPDATA%\school-fees-manager"
    echo   - Deleted school-fees-manager app data
)
if exist "%LOCALAPPDATA%\school-fees-manager" (
    rmdir /S /Q "%LOCALAPPDATA%\school-fees-manager"
    echo   - Deleted local school-fees-manager data
)
echo.

echo ========================================
echo   Reset complete!
echo ========================================
echo.
echo The app will now start fresh with the school setup wizard.
echo.
pause
