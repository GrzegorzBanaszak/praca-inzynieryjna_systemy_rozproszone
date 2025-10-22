# run-test.ps1 - Wersja dla Ingress (distributed.local)

Write-Host "========================================" -ForegroundColor Green
Write-Host "Test 5.1: Krotkotrwale zapytania synchroniczne" -ForegroundColor Green
Write-Host "Konfiguracja: Ingress (distributed.local)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green

# 1. Sprawdzenie wymagan
Write-Host "`n[1/7] Sprawdzanie wymagan..." -ForegroundColor Yellow

if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
    Write-Host "BLAD: k6 nie jest zainstalowane!" -ForegroundColor Red
    Write-Host "Instalacja: choco install k6" -ForegroundColor Yellow
    exit 1
}

if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    Write-Host "BLAD: kubectl nie jest zainstalowane!" -ForegroundColor Red
    Write-Host "Instalacja: choco install kubernetes-cli" -ForegroundColor Yellow
    exit 1
}

Write-Host "* Wymagania spelnionie" -ForegroundColor Green

# 2. Sprawdzenie klastra
Write-Host "`n[2/7] Sprawdzanie klastra Kubernetes..." -ForegroundColor Yellow

try {
    kubectl cluster-info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Klaster nie odpowiada"
    }
}
catch {
    Write-Host "BLAD: Klaster Kubernetes nie jest dostepny!" -ForegroundColor Red
    Write-Host "Uruchom: minikube start" -ForegroundColor Yellow
    exit 1
}

# Sprawdz namespace
try {
    kubectl get namespace distributed-system 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Namespace nie istnieje"
    }
}
catch {
    Write-Host "BLAD: Namespace 'distributed-system' nie istnieje!" -ForegroundColor Red
    Write-Host "Wdroz aplikacje: cd k8s && terraform apply" -ForegroundColor Yellow
    exit 1
}

Write-Host "* Klaster dziala" -ForegroundColor Green

# 3. Sprawdzenie Ingress
Write-Host "`n[3/7] Sprawdzanie Ingress..." -ForegroundColor Yellow

try {
    kubectl get ingress apigateway -n distributed-system 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Ingress nie istnieje"
    }
    Write-Host "* Ingress 'apigateway' istnieje" -ForegroundColor Green
}
catch {
    Write-Host "BLAD: Ingress 'apigateway' nie istnieje!" -ForegroundColor Red
    Write-Host "Sprawdz: kubectl get ingress -n distributed-system" -ForegroundColor Yellow
    exit 1
}

# Pobierz IP Minikube
$MINIKUBE_IP = minikube ip
Write-Host "Minikube IP: $MINIKUBE_IP" -ForegroundColor Cyan

# 4. Sprawdzenie wpisu w hosts
Write-Host "`n[4/7] Sprawdzanie pliku hosts..." -ForegroundColor Yellow

$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
$hostsContent = Get-Content $hostsPath -Raw

if ($hostsContent -notmatch "distributed\.local") {
    Write-Host "OSTRZEZENIE: Brak wpisu 'distributed.local' w pliku hosts!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Aby dodac wpis, uruchom PowerShell jako Administrator i wykonaj:" -ForegroundColor Yellow
    Write-Host "Add-Content -Path C:\Windows\System32\drivers\etc\hosts -Value `"`n$MINIKUBE_IP  distributed.local`"" -ForegroundColor White
    Write-Host ""
    Write-Host "LUB recznie dodaj do C:\Windows\System32\drivers\etc\hosts:" -ForegroundColor Yellow
    Write-Host "$MINIKUBE_IP  distributed.local" -ForegroundColor White
    Write-Host ""
    
    $response = Read-Host "Czy chcesz kontynuowac mimo to? (t/n)"
    if ($response -ne "t") {
        exit 1
    }
}
else {
    Write-Host "* Wpis 'distributed.local' istnieje w hosts" -ForegroundColor Green
}

# 5. Ustawienie adresu API Gateway
Write-Host "`n[5/7] Konfiguracja API Gateway..." -ForegroundColor Yellow

$env:API_GATEWAY = "http://distributed.local"
Write-Host "* API Gateway: $env:API_GATEWAY" -ForegroundColor Green

# 6. Test polaczenia
Write-Host "`n[6/7] Test polaczenia..." -ForegroundColor Yellow

try {
    $healthCheck = Invoke-WebRequest -Uri "$env:API_GATEWAY/api/product/healthz" -UseBasicParsing -TimeoutSec 10
    if ($healthCheck.StatusCode -eq 200) {
        Write-Host "* API Gateway odpowiada poprawnie" -ForegroundColor Green
        Write-Host "  Response: $($healthCheck.Content)" -ForegroundColor Cyan
    }
    else {
        Write-Host "OSTRZEZENIE: API Gateway zwrocil kod: $($healthCheck.StatusCode)" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "BLAD: Nie mozna polaczyc sie z API Gateway!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Sprawdz:" -ForegroundColor Yellow
    Write-Host "  1. kubectl get pods -n distributed-system" -ForegroundColor White
    Write-Host "  2. kubectl get ingress -n distributed-system" -ForegroundColor White
    Write-Host "  3. Czy wpis w hosts jest poprawny" -ForegroundColor White
    Write-Host "  4. ping distributed.local" -ForegroundColor White
    Write-Host ""
    Write-Host "Blad: $_" -ForegroundColor Red
    exit 1
}

# Sprawdz czy sa produkty
Write-Host ""
Write-Host "Sprawdzanie produktow w bazie..." -ForegroundColor Cyan

try {
    $products = Invoke-RestMethod -Uri "$env:API_GATEWAY/api/product" -TimeoutSec 10
    $productCount = ($products | Measure-Object).Count
    
    if ($productCount -eq 0) {
        Write-Host "OSTRZEZENIE: Brak produktow w bazie" -ForegroundColor Yellow
        Write-Host "Tworze przykladowe produkty..." -ForegroundColor Cyan
        
        $created = 0
        1..10 | ForEach-Object {
            $body = @{
                name  = "Produkt testowy $_"
                price = $_ * 10
                stock = 100
            } | ConvertTo-Json

            try {
                Invoke-RestMethod -Uri "$env:API_GATEWAY/api/product" `
                    -Method POST `
                    -ContentType "application/json" `
                    -Body $body `
                    -TimeoutSec 5 | Out-Null
                $created++
                Write-Host "  Utworzono produkt $_/10" -ForegroundColor Gray
            }
            catch {
                Write-Host "  Ostrzezenie: Nie udalo sie utworzyc produktu $_" -ForegroundColor Yellow
            }
        }
        
        Write-Host "* Utworzono $created produktow" -ForegroundColor Green
    }
    else {
        Write-Host "* W bazie znajduje sie $productCount produktow" -ForegroundColor Green
    }
}
catch {
    Write-Host "OSTRZEZENIE: Nie mozna sprawdzic produktow: $_" -ForegroundColor Yellow
}

# 7. Uruchomienie testu k6
Write-Host "`n[7/7] Uruchamianie testu k6..." -ForegroundColor Yellow

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$resultsDir = "..\wyniki\5.1-$timestamp"

# Utworz katalog na wyniki
if (-not (Test-Path "..\wyniki")) {
    New-Item -ItemType Directory -Path "..\wyniki" -Force | Out-Null
}

New-Item -ItemType Directory -Path $resultsDir -Force | Out-Null

Write-Host "Wyniki beda zapisane w: $resultsDir" -ForegroundColor Cyan
Write-Host ""

# Uruchom test k6
k6 run `
    --out "json=$resultsDir\results.json" `
    --summary-export="$resultsDir\summary.json" `
    test-synchroniczne.js 2>&1 | Tee-Object -FilePath "$resultsDir\output.log"

$testExitCode = $LASTEXITCODE

Write-Host ""
if ($testExitCode -eq 0) {
    Write-Host "* Test zakonczony sukcesem" -ForegroundColor Green
}
else {
    Write-Host "x Test zakonczony z bledami (kod: $testExitCode)" -ForegroundColor Red
}

# 8. Generowanie raportu
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "PODSUMOWANIE TESTU" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

if (Test-Path "$resultsDir\summary.json") {
    try {
        $summary = Get-Content "$resultsDir\summary.json" | ConvertFrom-Json
        
        $httpReqs = $summary.metrics.http_reqs.values.count
        $reqRate = [math]::Round($summary.metrics.http_reqs.values.rate, 2)
        $avgDuration = [math]::Round($summary.metrics.http_req_duration.values.avg, 2)
        $medDuration = [math]::Round($summary.metrics.http_req_duration.values.med, 2)
        $p95Duration = [math]::Round($summary.metrics.http_req_duration.values.'p(95)', 2)
        $p99Duration = [math]::Round($summary.metrics.http_req_duration.values.'p(99)', 2)
        $maxDuration = [math]::Round($summary.metrics.http_req_duration.values.max, 2)
        $errorRate = [math]::Round($summary.metrics.http_req_failed.values.rate * 100, 2)
        
        Write-Host ""
        Write-Host "Metryki HTTP:" -ForegroundColor Cyan
        Write-Host "  - Calkowite zadania: $httpReqs"
        Write-Host "  - Zadania/sekunde: $reqRate"
        Write-Host "  - Sredni czas odpowiedzi: ${avgDuration}ms"
        Write-Host "  - Mediana czasu odpowiedzi: ${medDuration}ms"
        Write-Host "  - P95 czas odpowiedzi: ${p95Duration}ms"
        Write-Host "  - P99 czas odpowiedzi: ${p99Duration}ms"
        Write-Host "  - Maksymalny czas odpowiedzi: ${maxDuration}ms"
        Write-Host "  - Wspolczynnik bledow: ${errorRate}%"
        
        # Ocena wynikow
        Write-Host ""
        Write-Host "Ocena wynikow:" -ForegroundColor Cyan
        
        $allPassed = $true
        
        if ($p95Duration -lt 500) {
            Write-Host "  * P95 < 500ms - Spelnione ($p95Duration ms)" -ForegroundColor Green
        }
        else {
            Write-Host "  x P95 >= 500ms - Niespelnione ($p95Duration ms)" -ForegroundColor Red
            $allPassed = $false
        }
        
        if ($errorRate -lt 5) {
            Write-Host "  * Bledy < 5% - Spelnione ($errorRate%)" -ForegroundColor Green
        }
        else {
            Write-Host "  x Bledy >= 5% - Niespelnione ($errorRate%)" -ForegroundColor Red
            $allPassed = $false
        }
        
        if ($reqRate -gt 50) {
            Write-Host "  * Przepustowosc > 50 req/s - Spelnione ($reqRate req/s)" -ForegroundColor Green
        }
        else {
            Write-Host "  x Przepustowosc <= 50 req/s - Niespelnione ($reqRate req/s)" -ForegroundColor Red
            $allPassed = $false
        }
        
        Write-Host ""
        if ($allPassed) {
            Write-Host "WYNIK: Test ZALICZONY" -ForegroundColor Green
        }
        else {
            Write-Host "WYNIK: Test NIEZALICZONY" -ForegroundColor Red
        }
        
        Write-Host ""
        Write-Host "Pelne wyniki dostepne w: $resultsDir" -ForegroundColor Cyan
    }
    catch {
        Write-Host "OSTRZEZENIE: Nie mozna przetworzyc pliku summary.json" -ForegroundColor Yellow
        Write-Host "Blad: $_" -ForegroundColor Red
    }
}
else {
    Write-Host "OSTRZEZENIE: Nie znaleziono pliku z podsumowaniem" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Test zakonczony!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green