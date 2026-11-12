@echo off
REM Borra la base de desarrollo (H2) y las fotos subidas. Al arrancar se crean de nuevo los datos de ejemplo.
REM Detén el backend antes de correr esto.
set ROOT=%~dp0..
if exist "%ROOT%\backend\data" rmdir /s /q "%ROOT%\backend\data"
echo Base de desarrollo borrada.
