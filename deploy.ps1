param([string]$msg = "")

if (-not $msg) {
    $data = Get-Date -Format "dd/MM/yyyy HH:mm"
    $msg = "deploy: atualizacao $data"
}

Write-Host "[1/3] Adicionando arquivos alterados..." -ForegroundColor Cyan
git add -A

Write-Host "[2/3] Criando commit: '$msg'..." -ForegroundColor Cyan
git commit -m "$msg"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[3/3] Enviando alteracoes para o Git (origin main)..." -ForegroundColor Yellow
    git push origin main
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK: Deploy realizado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "ERRO: Falha ao enviar para o Git remoto." -ForegroundColor Red
    }
} else {
    Write-Host "INFO: Nenhuma alteracao pendente para commitar." -ForegroundColor Yellow
}
