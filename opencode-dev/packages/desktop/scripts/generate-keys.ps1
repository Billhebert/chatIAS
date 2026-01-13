# =============================================================================
# SUATEC - Gerador de Chaves para Atualizações
# =============================================================================
# Execute este script UMA VEZ para gerar o par de chaves de assinatura
# =============================================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopDir = Split-Path -Parent $ScriptDir
$TauriDir = Join-Path $DesktopDir "src-tauri"
$PrivateKeyFile = Join-Path $TauriDir ".tauri-updater-key"
$ConfigFile = Join-Path $TauriDir "tauri.prod.conf.json"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "    SUATEC - Gerador de Chaves de Assinatura " -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host ""

# Verificar se já existe
if (Test-Path $PrivateKeyFile) {
    Write-Host "ATENCAO: Já existe uma chave privada em:" -ForegroundColor Red
    Write-Host "  $PrivateKeyFile" -ForegroundColor White
    Write-Host ""
    $confirm = Read-Host "Deseja substituir? (s/N)"
    if ($confirm -ne "s" -and $confirm -ne "S") {
        Write-Host "Operação cancelada." -ForegroundColor Yellow
        exit 0
    }
    Remove-Item $PrivateKeyFile -Force
}

Write-Host "Gerando par de chaves..." -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANTE: Quando pedir senha, você pode:" -ForegroundColor Yellow
Write-Host "  - Deixar em branco (apenas pressione Enter)" -ForegroundColor White
Write-Host "  - Ou definir uma senha (lembre-se dela!)" -ForegroundColor White
Write-Host ""

Push-Location $DesktopDir
try {
    bun tauri signer generate -w src-tauri/.tauri-updater-key
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=============================================" -ForegroundColor Green
        Write-Host "         CHAVES GERADAS COM SUCESSO!         " -ForegroundColor Green
        Write-Host "=============================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "CHAVE PRIVADA salva em:" -ForegroundColor Yellow
        Write-Host "  $PrivateKeyFile" -ForegroundColor White
        Write-Host ""
        Write-Host "IMPORTANTE:" -ForegroundColor Red
        Write-Host "  1. NUNCA compartilhe a chave privada!" -ForegroundColor White
        Write-Host "  2. Adicione ao .gitignore: .tauri-updater-key" -ForegroundColor White
        Write-Host "  3. Faca backup seguro da chave privada!" -ForegroundColor White
        Write-Host ""
        Write-Host "PROXIMO PASSO:" -ForegroundColor Yellow
        Write-Host "  Copie a CHAVE PUBLICA exibida acima e cole em:" -ForegroundColor White
        Write-Host "  $ConfigFile" -ForegroundColor Cyan
        Write-Host "  No campo: plugins.updater.pubkey" -ForegroundColor White
        Write-Host ""
    }
}
finally {
    Pop-Location
}
