@echo off
chcp 65001 >nul
setlocal

echo Encerrando processos Node que possam bloquear node_modules...
taskkill /F /IM node.exe >nul 2>&1

echo Removendo instalacao parcial...
if exist node_modules rmdir /S /Q node_modules

if exist node_modules (
  echo.
  echo ERRO: O Windows ainda esta bloqueando a pasta node_modules.
  echo Feche o VS Code, terminais e janelas do Explorador abertas nesta pasta.
  echo Depois execute este arquivo como Administrador.
  pause
  exit /b 1
)

echo Instalando versoes validadas pelo registro oficial do npm...
call npm ci --registry=https://registry.npmjs.org/
if errorlevel 1 (
  echo.
  echo A instalacao falhou. Verifique a conexao com a internet e execute:
  echo npm config get registry
  echo O resultado correto e https://registry.npmjs.org/
  pause
  exit /b 1
)

echo.
echo Instalacao concluida. Iniciando o CRM...
call npm run dev
endlocal
