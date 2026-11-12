@echo off
REM Brindix en desarrollo: abre el backend (8080) y el frontend (4200) en dos ventanas.
REM Despues entra a http://localhost:4200  (admin / admin12345, mesero / mesero12345)
set ROOT=%~dp0..
start "Brindix backend" cmd /k "cd /d %ROOT%\backend && mvn -q spring-boot:run"
start "Brindix frontend" cmd /k "set PATH=C:\Users\Asus\node20;%PATH% && cd /d %ROOT%\frontend && npx ng serve --port 4200"
echo Arrancando... en unos segundos abre http://localhost:4200
