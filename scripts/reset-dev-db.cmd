@echo off
REM Borra la base de desarrollo (H2) y las fotos locales. Al arrancar se crean de nuevo el súper administrador y el bar "demo".
REM Detén el backend antes de correr esto.
set ROOT=%~dp0..
if exist "%ROOT%\backend\data" rmdir /s /q "%ROOT%\backend\data"
echo Base de desarrollo borrada.
