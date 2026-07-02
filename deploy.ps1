param([string]$msg = "")

if (-not $msg) {
    $data = Get-Date -Format "dd/MM HH:mm"
    $msg = "deploy: atualizacao $data"
}

git add -A

git commit -m "$msg"
if ($?) {
    git push origin main
    if ($?) {
        Write-Output "OK - Deploy enviado"
    } else {
        Write-Output "Falha no push"
    }
} else {
    Write-Output "Nada a commitar"
}
