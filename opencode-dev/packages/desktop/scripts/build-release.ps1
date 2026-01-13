# =============================================================================
# SUATEC - Script de Build e Release
# =============================================================================
# Este script automatiza o processo de compilação e preparação de releases
# para o repositório GitHub: https://github.com/Billhebert/suatec-app-releases
# =============================================================================

param(
    [string]$Version = "",
    [string]$Notes = "Nova versão do Suatec",
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"

# Cores para output
function Write-Step { param($msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "   [ERRO] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "   $msg" -ForegroundColor Gray }

# Diretórios
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopDir = Split-Path -Parent $ScriptDir
$TauriDir = Join-Path $DesktopDir "src-tauri"
$ReleaseDir = Join-Path $TauriDir "target\release"
$BundleDir = Join-Path $ReleaseDir "bundle\nsis"
$OutputDir = Join-Path $DesktopDir "release-output"

# Arquivo de chave privada
$PrivateKeyFile = Join-Path $TauriDir ".tauri-updater-key"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "       SUATEC - Build & Release Script       " -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow

# =============================================================================
# 1. Verificar chave de assinatura
# =============================================================================
Write-Step "Verificando chave de assinatura..."

if (-not (Test-Path $PrivateKeyFile)) {
    Write-Error "Chave privada não encontrada em: $PrivateKeyFile"
    Write-Host ""
    Write-Host "Para gerar uma nova chave, execute:" -ForegroundColor Yellow
    Write-Host "  cd $DesktopDir" -ForegroundColor White
    Write-Host "  bun tauri signer generate -w src-tauri/.tauri-updater-key" -ForegroundColor White
    Write-Host ""
    Write-Host "Depois, copie a CHAVE PUBLICA e cole em:" -ForegroundColor Yellow
    Write-Host "  src-tauri/tauri.prod.conf.json -> plugins.updater.pubkey" -ForegroundColor White
    exit 1
}
Write-Success "Chave privada encontrada"

# =============================================================================
# 2. Obter versão do package.json
# =============================================================================
Write-Step "Obtendo versão..."

$PackageJson = Get-Content (Join-Path $DesktopDir "package.json") | ConvertFrom-Json
$CurrentVersion = $PackageJson.version

if ($Version -eq "") {
    $Version = $CurrentVersion
}

Write-Success "Versão: $Version"

# =============================================================================
# 3. Configurar variáveis de ambiente
# =============================================================================
Write-Step "Configurando ambiente..."

$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $PrivateKeyFile -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
$env:RUST_TARGET = "x86_64-pc-windows-msvc"

Write-Success "Variáveis de ambiente configuradas"

# =============================================================================
# 4. Build do aplicativo
# =============================================================================
if (-not $SkipBuild) {
    Write-Step "Compilando aplicativo (isso pode demorar alguns minutos)..."
    
    Push-Location $DesktopDir
    try {
        # Adicionar cargo ao PATH
        $env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
        
        # Executar build
        bun run tauri build 2>&1 | ForEach-Object { Write-Info $_ }
        
        if ($LASTEXITCODE -ne 0) {
            throw "Build falhou com código: $LASTEXITCODE"
        }
        Write-Success "Build concluído"
    }
    finally {
        Pop-Location
    }
} else {
    Write-Info "Build ignorado (flag -SkipBuild)"
}

# =============================================================================
# 5. Preparar diretório de output
# =============================================================================
Write-Step "Preparando arquivos para release..."

if (Test-Path $OutputDir) {
    Remove-Item $OutputDir -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputDir | Out-Null

# =============================================================================
# 6. Copiar arquivos de instalação
# =============================================================================
$InstallerExe = Get-ChildItem -Path $BundleDir -Filter "*.exe" | Select-Object -First 1
$NsisZip = Get-ChildItem -Path $BundleDir -Filter "*.nsis.zip" | Select-Object -First 1
$NsisSig = Get-ChildItem -Path $BundleDir -Filter "*.nsis.zip.sig" | Select-Object -First 1

if ($InstallerExe) {
    Copy-Item $InstallerExe.FullName -Destination $OutputDir
    Write-Success "Instalador: $($InstallerExe.Name)"
} else {
    Write-Error "Instalador .exe não encontrado"
}

if ($NsisZip) {
    Copy-Item $NsisZip.FullName -Destination $OutputDir
    Write-Success "Pacote de atualização: $($NsisZip.Name)"
} else {
    Write-Error "Pacote .nsis.zip não encontrado"
}

if ($NsisSig) {
    Copy-Item $NsisSig.FullName -Destination $OutputDir
    Write-Success "Assinatura: $($NsisSig.Name)"
} else {
    Write-Error "Arquivo de assinatura .sig não encontrado"
}

# =============================================================================
# 7. Gerar latest.json
# =============================================================================
Write-Step "Gerando latest.json..."

$Signature = ""
if ($NsisSig) {
    $Signature = Get-Content $NsisSig.FullName -Raw
    $Signature = $Signature.Trim()
}

$UpdateUrl = "https://github.com/Billhebert/suatec-app-releases/releases/download/v$Version/$($NsisZip.Name)"
$PubDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

$LatestJson = @{
    version = $Version
    notes = $Notes
    pub_date = $PubDate
    platforms = @{
        "windows-x86_64" = @{
            signature = $Signature
            url = $UpdateUrl
        }
    }
} | ConvertTo-Json -Depth 4

$LatestJsonPath = Join-Path $OutputDir "latest.json"
$LatestJson | Out-File -FilePath $LatestJsonPath -Encoding utf8

Write-Success "latest.json gerado"

# =============================================================================
# 8. Resumo
# =============================================================================
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "           BUILD CONCLUÍDO!                  " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Arquivos prontos em:" -ForegroundColor Yellow
Write-Host "  $OutputDir" -ForegroundColor White
Write-Host ""
Write-Host "Arquivos gerados:" -ForegroundColor Yellow
Get-ChildItem $OutputDir | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }
Write-Host ""
Write-Host "PROXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "  1. Acesse: https://github.com/Billhebert/suatec-app-releases/releases/new" -ForegroundColor White
Write-Host "  2. Tag: v$Version" -ForegroundColor White
Write-Host "  3. Titulo: Suatec v$Version" -ForegroundColor White
Write-Host "  4. Faça upload de TODOS os arquivos da pasta release-output" -ForegroundColor White
Write-Host "  5. Publique a release!" -ForegroundColor White
Write-Host ""
Write-Host "Ou use o GitHub CLI:" -ForegroundColor Yellow
Write-Host "  gh release create v$Version $OutputDir/* --repo Billhebert/suatec-app-releases --title `"Suatec v$Version`" --notes `"$Notes`"" -ForegroundColor White
Write-Host ""
