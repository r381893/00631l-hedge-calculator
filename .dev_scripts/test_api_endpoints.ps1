$apiDir = "C:\Users\jack\Desktop\Github_backup_test\streamlit-option-app-main\00631L-hedge-frontend\api"
Push-Location $apiDir

Write-Output "Starting server (python app.py) in background..."
Start-Process -FilePath "python" -ArgumentList "app.py" -WindowStyle Hidden
Start-Sleep -Seconds 4

$ports = 5000..5010
foreach ($p in $ports) {
    $base = "http://localhost:$p"
    Write-Output "=== Testing port $p ==="
    try {
        $r = Invoke-RestMethod -Uri ($base + "/api/taifex-debug") -TimeoutSec 6 -ErrorAction Stop
        Write-Output "--- $p /taifex-debug OK ---"
        $r | ConvertTo-Json -Depth 5 | Write-Output
    } catch {
        Write-Output "--- $p /taifex-debug ERROR: $($_.Exception.Message) ---"
    }
    try {
        $r = Invoke-RestMethod -Uri ($base + "/api/fubon-debug") -TimeoutSec 6 -ErrorAction Stop
        Write-Output "--- $p /fubon-debug OK ---"
        $r | ConvertTo-Json -Depth 5 | Write-Output
    } catch {
        Write-Output "--- $p /fubon-debug ERROR: $($_.Exception.Message) ---"
    }
}

Pop-Location
