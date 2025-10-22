# diagnose-ingress.ps1 - Diagnostyka konfiguracji Ingress

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostyka Ingress (distributed.local)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Minikube
Write-Host "`n[1] Minikube:" -ForegroundColor Yellow
try {
    $MINIKUBE_IP = minikube ip
    Write-Host "  IP: $MINIKUBE_IP" -ForegroundColor Green
    minikube status
}
catch {
    Write-Host "  BLAD: Minikube nie dziala!" -ForegroundColor Red
    Write-Host "  Uruchom: minikube start" -ForegroundColor Yellow
}

# 2. Ingress addon
Write-Host "`n[2] Ingress addon:" -ForegroundColor Yellow
$ingressAddon = minikube addons list | Select-String "ingress"
if ($ingressAddon -match "enabled") {
    Write-Host "  * Ingress addon jest wlaczony" -ForegroundColor Green
}
else {
    Write-Host "  x Ingress addon jest wylaczony!" -ForegroundColor Red
    Write-Host "  Wlacz: minikube addons enable ingress" -ForegroundColor Yellow
}

# 3. Namespace
Write-Host "`n[3] Namespace distributed-system:" -ForegroundColor Yellow
try {
    kubectl get namespace distributed-system 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  * Namespace istnieje" -ForegroundColor Green
    }
    else {
        throw "Namespace nie istnieje"
    }
}
catch {
    Write-Host "  x Namespace nie istnieje!" -ForegroundColor Red
    Write-Host "  Wdroz aplikacje: cd k8s && terraform apply" -ForegroundColor Yellow
}

# 4. Ingress resource
Write-Host "`n[4] Ingress resource:" -ForegroundColor Yellow
try {
    $ingress = kubectl get ingress apigateway -n distributed-system -o json 2>$null | ConvertFrom-Json
    if ($ingress) {
        Write-Host "  * Ingress 'apigateway' istnieje" -ForegroundColor Green
        Write-Host "  Host: $($ingress.spec.rules[0].host)" -ForegroundColor Cyan
        Write-Host "  Path: $($ingress.spec.rules[0].http.paths[0].path)" -ForegroundColor Cyan
        Write-Host "  Backend: $($ingress.spec.rules[0].http.paths[0].backend.service.name):$($ingress.spec.rules[0].http.paths[0].backend.service.port.number)" -ForegroundColor Cyan
    }
}
catch {
    Write-Host "  x Ingress nie istnieje!" -ForegroundColor Red
    Write-Host "  Sprawdz: kubectl get ingress -n distributed-system" -ForegroundColor Yellow
}

# 5. Plik hosts
Write-Host "`n[5] Plik hosts:" -ForegroundColor Yellow
$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
try {
    $hostsContent = Get-Content $hostsPath -Raw
    $hostsEntry = $hostsContent | Select-String "distributed\.local"
    
    if ($hostsEntry) {
        Write-Host "  * Znaleziono wpis:" -ForegroundColor Green
        $hostsEntry -split "`n" | ForEach-Object {
            if ($_ -match "distributed\.local") {
                Write-Host "    $_" -ForegroundColor Cyan
            }
        }
    }
    else {
        Write-Host "  x Brak wpisu dla distributed.local!" -ForegroundColor Red
        Write-Host "  Dodaj (jako Administrator):" -ForegroundColor Yellow
        Write-Host "    $MINIKUBE_IP  distributed.local" -ForegroundColor White
    }
}
catch {
    Write-Host "  x Nie mozna odczytac pliku hosts" -ForegroundColor Red
}

# 6. Test DNS
Write-Host "`n[6] Test DNS:" -ForegroundColor Yellow
try {
    $dnsTest = Resolve-DnsName distributed.local -ErrorAction Stop 2>$null
    Write-Host "  * DNS rozwiazuje sie na: $($dnsTest.IPAddress)" -ForegroundColor Green
}
catch {
    Write-Host "  x Nie mozna rozwiazac distributed.local" -ForegroundColor Red
    Write-Host "  Sprawdz plik hosts i wykonaj: ipconfig /flushdns" -ForegroundColor Yellow
}

# 7. Test ping
Write-Host "`n[7] Test ping:" -ForegroundColor Yellow
try {
    $pingTest = Test-Connection distributed.local -Count 2 -Quiet
    if ($pingTest) {
        Write-Host "  * Ping do distributed.local dziala" -ForegroundColor Green
    }
    else {
        Write-Host "  x Ping do distributed.local nie dziala" -ForegroundColor Red
    }
}
catch {
    Write-Host "  x Ping zakonczony bledem: $_" -ForegroundColor Red
}

# 8. Test HTTP
Write-Host "`n[8] Test HTTP:" -ForegroundColor Yellow
try {
    $httpTest = Invoke-WebRequest -Uri "http://distributed.local/api/product/healthz" -UseBasicParsing -TimeoutSec 5
    Write-Host "  * HTTP dziala - Status: $($httpTest.StatusCode)" -ForegroundColor Green
    Write-Host "  Response: $($httpTest.Content)" -ForegroundColor Cyan
}
catch {
    Write-Host "  x HTTP nie dziala!" -ForegroundColor Red
    Write-Host "  Blad: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 9. Pody aplikacji
Write-Host "`n[9] Status podow:" -ForegroundColor Yellow
try {
    $pods = kubectl get pods -n distributed-system --no-headers 2>$null
    if ($pods) {
        $pods -split "`n" | ForEach-Object {
            $fields = $_ -split "\s+"
            $name = $fields[0]
            $ready = $fields[1]
            $status = $fields[2]
            
            if ($status -eq "Running" -and $ready -match "1/1") {
                Write-Host "  * $name - $status ($ready)" -ForegroundColor Green
            }
            else {
                Write-Host "  x $name - $status ($ready)" -ForegroundColor Red
            }
        }
    }
}
catch {
    Write-Host "  x Nie mozna pobrac listy podow" -ForegroundColor Red
}

# 10. Service ApiGateway
Write-Host "`n[10] Service ApiGateway:" -ForegroundColor Yellow
try {
    $svc = kubectl get svc apigateway -n distributed-system -o json 2>$null | ConvertFrom-Json
    if ($svc) {
        Write-Host "  * Service istnieje" -ForegroundColor Green
        Write-Host "  Type: $($svc.spec.type)" -ForegroundColor Cyan
        Write-Host "  Port: $($svc.spec.ports[0].port)" -ForegroundColor Cyan
    }
}
catch {
    Write-Host "  x Service nie istnieje!" -ForegroundColor Red
}

# Podsumowanie
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PODSUMOWANIE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$problems = @()

# Sprawdz kluczowe elementy
if (-not $MINIKUBE_IP) { $problems += "Minikube nie dziala" }
if ($ingressAddon -notmatch "enabled") { $problems += "Ingress addon wylaczony" }
if (-not $hostsEntry) { $problems += "Brak wpisu w hosts" }

try {
    kubectl get namespace distributed-system 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { $problems += "Namespace nie istnieje" }
}
catch { $problems += "Namespace nie istnieje" }

try {
    Invoke-WebRequest -Uri "http://distributed.local/api/product/healthz" -UseBasicParsing -TimeoutSec 5 | Out-Null
}
catch {
    $problems += "HTTP nie dziala"
}

if ($problems.Count -eq 0) {
    Write-Host "`n* Wszystko dziala poprawnie!" -ForegroundColor Green
    Write-Host "Mozesz uruchomic test: .\run-test.ps1" -ForegroundColor Cyan
}
else {
    Write-Host "`nZnalezione problemy:" -ForegroundColor Red
    $problems | ForEach-Object {
        Write-Host "  x $_" -ForegroundColor Red
    }
    Write-Host "`nNapraw powyzsze problemy przed uruchomieniem testu." -ForegroundColor Yellow
}

Write-Host ""