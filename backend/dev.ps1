# Geliştirme sunucusu — uvicorn --reload + dış restart döngüsü.
#
# Avantajlar:
#  * Normal kod değişiklikleri uvicorn'un kendi reload mekanizmasıyla yenilenir.
#  * Reloader subprocess'i crash olursa (örn. import-time syntax hatası) dış while
#    döngüsü 2 saniye sonra otomatik tekrar başlatır → sürekli elle başlatmaya gerek yok.
#  * Ctrl+C ile çıkmak için iki kez basın (ilk basış uvicorn'u, ikinci basış dış döngüyü kapatır)
#    veya pencereyi kapatın.
#
# Sadece `app/` izlenir; alembic ve kök dosya değişimleri reload tetiklemez.

Set-Location $PSScriptRoot

# Windows'ta dosya değişikliğini daha güvenilir yakalamak için polling
$env:WATCHFILES_FORCE_POLLING = "true"

$stopFlag = $false

# İkinci Ctrl+C dış döngüden çıksın diye flag
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    $script:stopFlag = $true
}

while (-not $stopFlag) {
    Write-Host "── uvicorn başlatılıyor (Ctrl+C ile durdur) ──" -ForegroundColor Cyan
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --reload-dir app --timeout-graceful-shutdown 2
    $exitCode = $LASTEXITCODE

    if ($stopFlag) { break }

    Write-Host ""
    Write-Host "uvicorn süreci sonlandı (exit=$exitCode). 2 saniye sonra yeniden başlatılıyor..." -ForegroundColor Yellow
    Write-Host "(Dış döngüden çıkmak için bu pencerede Ctrl+C'ye tekrar basın)" -ForegroundColor DarkGray
    Start-Sleep -Seconds 2
}
