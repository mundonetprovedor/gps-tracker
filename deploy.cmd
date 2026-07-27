@echo off
set MSG=%*
if "%MSG%"=="" (
    set MSG=deploy: atualizacao automatica
)

echo 📦 Adicionando arquivos alterados...
git add -A

echo 💾 Criando commit: "%MSG%"...
git commit -m "%MSG%"

echo 🚀 Enviando alteracoes para o Git (origin main)...
git push origin main

echo ✅ Deploy concluido!
