# Przewodnik: gRPC w Minikube - Modyfikacje dla Twojego środowiska

## Różnice między ogólnym przewodnikiem a Minikube

Dobra wiadomość: większość instrukcji z głównego przewodnika (`przewodnik_rest_vs_grpc.md`) działa identycznie w Minikube. Poniżej znajdziesz TYLKO te rzeczy, które są specyficzne dla Twojego środowiska.

---

## CZĘŚĆ 1: Modyfikacje Terraform

### 1.1 Dodanie zmiennej HTTP_PROTOCOLS do deploymentów

Musisz zmodyfikować następujące pliki Terraform, dodając jedną zmienną środowiskową do każdego kontenera .NET:

**Pliki do modyfikacji:**
- `k8s/apps-user.tf`
- `k8s/apps-order.tf`
- `k8s/apps-product-scaling.tf`
- `k8s/apps-notification.tf` (opcjonalnie, jeśli będziesz tam dodawać gRPC)

**Co dodać:**
W każdym pliku, w sekcji `container { env { ... } }`, dodaj:

```hcl
env {
  name  = "ASPNETCORE_HTTP_PROTOCOLS"
  value = "Http1AndHttp2"
}
```

**Przykład dla apps-user.tf:**

```hcl
resource "kubernetes_deployment_v1" "user" {
  metadata {
    name      = "userservice"
    namespace = var.namespace
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "userservice" } }
    template {
      metadata { labels = { app = "userservice" } }
      spec {
        container {
          name              = "userservice"
          image             = var.image_userservice
          image_pull_policy = "Never"
          
          # Istniejące env_from i env...
          
          env {
            name  = "ASPNETCORE_URLS"
            value = "http://+:80"
          }
          
          # ↓ DODAJ TO ↓
          env {
            name  = "ASPNETCORE_HTTP_PROTOCOLS"
            value = "Http1AndHttp2"
          }
          # ↑ KONIEC DODANIA ↑
          
          # Pozostałe zmienne JWT itp...
          env {
            name = "JwtSettings__Key"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.jwt.metadata[0].name
                key  = "Jwt__Key"
              }
            }
          }
          
          # ... reszta konfiguracji pozostaje bez zmian
        }
      }
    }
  }
}
```

**Dlaczego to jest potrzebne:**
ASP.NET Core w kontenerach domyślnie może używać tylko HTTP/1.1. Ustawienie `Http1AndHttp2` mówi Kestrel (serwerowi webowemu w .NET), żeby obsługiwał oba protokoły jednocześnie na tym samym porcie 80. Dzięki temu:
- REST API (HTTP/1.1 + JSON) działa na porcie 80
- gRPC (HTTP/2 + Protobuf) działa NA TYM SAMYM porcie 80

To jest kluczowe w Kubernetes, bo nie chcemy eksponować dwóch różnych portów.

### 1.2 Modyfikacja apps-gateway.tf (opcjonalna)

Obecnie Twój API Gateway używa YARP 2.3.0. Dla początkowych testów **NIE MUSISZ** go modyfikować. Możesz testować:
- REST przez Gateway (jak dotychczas)
- gRPC bezpośrednio do serwisów (omijając Gateway)

To jest uczciwe porównanie, bo symuluje typowy pattern mikrousług, gdzie:
- Klienci zewnętrzni używają REST przez Gateway
- Serwisy wewnętrznie komunikują się przez gRPC

**Jeśli jednak chcesz routować gRPC przez Gateway** (dla bardziej zaawansowanych testów), możesz upgrade'ować YARP:

```hcl
# apps-gateway.tf
# W sekcji PackageReference w obrazie Docker:
# Zmień:
# <PackageReference Include="Yarp.ReverseProxy" Version="2.3.0" />
# Na:
# <PackageReference Include="Yarp.ReverseProxy" Version="3.0.0" />

# Następnie dodaj zmienną środowiskową:
resource "kubernetes_deployment_v1" "apigateway" {
  # ... istniejąca konfiguracja ...
  spec {
    template {
      spec {
        container {
          name = "apigateway"
          
          # Dodaj:
          env {
            name  = "ASPNETCORE_HTTP_PROTOCOLS"
            value = "Http1AndHttp2"
          }
          
          # Reszta bez zmian...
        }
      }
    }
  }
}
```

Ale powtarzam: **na początku tego nie rób**. Zacznij od prostszego podejścia.

---

## CZĘŚĆ 2: Testowanie w Minikube

### 2.1 Dostęp do serwisów - trzy metody

W Minikube masz kilka sposobów dostępu do serwisów. Każdy ma swoje zastosowanie.

#### Metoda 1: Port Forwarding (najlepsza do debugowania)

```bash
# Terminal 1 - UserService
kubectl port-forward -n distributed-system svc/userservice 5185:80

# Terminal 2 - ProductService  
kubectl port-forward -n distributed-system svc/productservice 5282:80

# Terminal 3 - OrderService
kubectl port-forward -n distributed-system svc/orderservice 5093:80

# Teraz w Terminal 4 możesz testować:
grpcurl -plaintext localhost:5185 user.UserService/Register \
  -d '{"username": "test", "password": "pass123"}'
```

**Zalety:**
- Najprostsze do debugowania
- Nie wymaga NodePort
- Działa identycznie jak w produkcji

**Wady:**
- Wymaga osobnego terminala dla każdego serwisu
- Nie sprawdza pełnego network stacku Kubernetes

#### Metoda 2: NodePort (dobra do testów k6)

Twoje serwisy są skonfigurowane jako ClusterIP. Możesz je tymczasowo zmienić na NodePort dla testów:

```bash
# Sprawdź IP Minikube
minikube ip
# Np. 192.168.49.2

# Zmień serwis na NodePort (tymczasowo)
kubectl patch svc userservice -n distributed-system -p '{"spec":{"type":"NodePort"}}'

# Sprawdź przydzielony port
kubectl get svc userservice -n distributed-system
# NAME          TYPE       CLUSTER-IP     EXTERNAL-IP   PORT(S)        AGE
# userservice   NodePort   10.96.123.45   <none>        80:30123/TCP   5m

# Teraz możesz testować przez:
grpcurl -plaintext 192.168.49.2:30123 user.UserService/Register
```

**Zalety:**
- k6 może łączyć się bezpośrednio z zewnątrz
- Testuje pełny stos sieciowy Kubernetes
- Nie wymaga port-forward

**Wady:**
- Losowy port (30000-32767)
- Wymaga zmiany typu serwisu

#### Metoda 3: Przez Ingress (dla REST przez Gateway)

To już masz skonfigurowane. Twój `minikube tunnel` wystawia Ingress na `distributed.local`. Dla REST to działa bez zmian.

Dla gRPC przez Ingress potrzebowałbyś dodatkowej konfiguracji w NGINX Ingress, ale jak mówiłem - nie jest to konieczne na początku.

### 2.2 Weryfikacja, że HTTP/2 działa

Po deployment serwisów z nową zmienną `ASPNETCORE_HTTP_PROTOCOLS`, sprawdź logi:

```bash
# Sprawdź logi UserService
kubectl logs -n distributed-system deployment/userservice

# Powinieneś zobaczyć coś jak:
# info: Microsoft.Hosting.Lifetime[14]
#       Now listening on: http://[::]:80
# info: Microsoft.AspNetCore.Server.Kestrel[0]
#       Server is ready to accept connections on http://[::]:80
# WAŻNE: Kestrel automatycznie negocjuje HTTP/2 z klientem gRPC
```

Brak błędów związanych z protokołem = wszystko OK.

### 2.3 Test gRPC w Minikube - krok po kroku

Po wdrożeniu zmian, przetestuj pełny flow:

```bash
# 1. Port-forward dla UserService
kubectl port-forward -n distributed-system svc/userservice 5185:80 &

# 2. Rejestracja przez gRPC
grpcurl -plaintext localhost:5185 user.UserService/Register \
  -d '{
    "username": "minikubetest",
    "password": "test123"
  }'

# Oczekiwany wynik:
# {
#   "success": true,
#   "message": "Rejestracja zakończona sukcesem"
# }

# 3. Logowanie przez gRPC
grpcurl -plaintext localhost:5185 user.UserService/Login \
  -d '{
    "username": "minikubetest", 
    "password": "test123"
  }'

# Skopiuj token z odpowiedzi, np:
# {
#   "success": true,
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "message": "Zalogowano pomyślnie"
# }

# 4. Port-forward dla ProductService
kubectl port-forward -n distributed-system svc/productservice 5282:80 &

# 5. Pobierz produkty przez gRPC
grpcurl -plaintext localhost:5282 product.ProductService/GetAll

# Powinieneś zobaczyć listę produktów w formacie Protobuf (JSON-like)

# 6. Port-forward dla OrderService
kubectl port-forward -n distributed-system svc/orderservice 5093:80 &

# 7. Utwórz zamówienie przez gRPC (z tokenem)
# UWAGA: W gRPC token JWT przekazujemy w metadanych (header), nie w body
grpcurl -plaintext \
  -H "Authorization: Bearer TWOJ_TOKEN_TUTAJ" \
  localhost:5093 order.OrderService/Create \
  -d '{
    "product_id": "ID_PRODUKTU_Z_KROKU_5",
    "quantity": 2
  }'

# Oczekiwany wynik:
# {
#   "success": true,
#   "order": {
#     "id": "...",
#     "userId": "...",
#     "productId": "...",
#     "quantity": 2,
#     "createdAt": "..."
#   },
#   "message": "Zamówienie utworzone pomyślnie"
# }
```

Jeśli wszystkie 7 kroków przeszły pomyślnie - gratulacje! gRPC działa w Twoim klastrze Minikube.

---

## CZĘŚĆ 3: Architektura testów k6 w Minikube

### 3.1 Routing w testach

Dla sprawiedliwego porównania REST vs gRPC w Minikube, proponuję następującą architekturę:

```
┌─────────────────────────────────────────────────────────────┐
│                        k6 Test Runner                        │
│              (uruchomiony na Twoim komputerze)              │
└────────────┬──────────────────────────────┬─────────────────┘
             │                               │
             │ REST                          │ gRPC
             │ HTTP/1.1 + JSON               │ HTTP/2 + Protobuf
             │                               │
             ▼                               ▼
    ┌────────────────┐              ┌─────────────────┐
    │ Minikube       │              │ Minikube        │
    │ Ingress        │              │ Service         │
    │ (distributed   │              │ (NodePort lub   │
    │  .local)       │              │  port-forward)  │
    └────────┬───────┘              └────────┬────────┘
             │                               │
             ▼                               │
    ┌────────────────┐                      │
    │ API Gateway    │                      │
    │ (YARP proxy)   │                      │
    └────────┬───────┘                      │
             │                               │
             ├───────────────────────────────┤
             │                               │
        ┌────▼────┐  ┌──────────┐  ┌────────▼──┐
        │ User    │  │ Product  │  │ Order     │
        │ Service │  │ Service  │  │ Service   │
        └─────────┘  └──────────┘  └───────────┘
```

**Dlaczego ta architektura ma sens:**

**REST przez Gateway:**
- Symuluje scenariusz użycia produkcyjnego
- Klient zewnętrzny (k6) → Gateway → Serwisy
- Testuje pełną ścieżkę sieciową z proxy

**gRPC bezpośrednio:**
- Symuluje komunikację service-to-service
- Serwis → Serwis przez gRPC (bez proxy)
- To jest typowy pattern w mikrousługach

W produkcji często masz oba podejścia:
- REST dla klientów mobilnych/webowych przez Gateway
- gRPC dla komunikacji wewnętrznej między serwisami

### 3.2 Konfiguracja k6 dla Minikube

k6 ma eksperymentalną obsługę gRPC. Musisz użyć specjalnej wersji:

```bash
# Instalacja k6 z obsługą gRPC (jeśli jeszcze nie masz)
# Windows (Scoop):
scoop install k6

# Linux:
wget https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz
tar -xzf k6-v0.47.0-linux-amd64.tar.gz
sudo mv k6-v0.47.0-linux-amd64/k6 /usr/local/bin/

# macOS:
brew install k6

# Sprawdź wersję (potrzebujesz ≥ 0.47.0 dla dobrego wsparcia gRPC)
k6 version
```

**Przykład testu k6 dla gRPC w Minikube:**

```javascript
// test-grpc-minikube.js
import grpc from 'k6/net/grpc';
import { check } from 'k6';

// Ustaw adres NodePort lub port-forward
const GRPC_HOST = '192.168.49.2:30185'; // Zmień na swój Minikube IP + NodePort

const client = new grpc.Client();
client.load(['../src/Protos'], 'user.proto'); // Ścieżka do pliku .proto

export default function () {
  // Połącz z UserService
  client.connect(GRPC_HOST, { plaintext: true });

  // Rejestracja
  const registerResponse = client.invoke('user.UserService/Register', {
    username: `user_${__VU}_${__ITER}`,
    password: 'test123'
  });

  check(registerResponse, {
    'register successful': (r) => r && r.message.success === true,
  });

  // Logowanie
  const loginResponse = client.invoke('user.UserService/Login', {
    username: `user_${__VU}_${__ITER}`,
    password: 'test123'
  });

  check(loginResponse, {
    'login successful': (r) => r && r.message.success === true,
    'token received': (r) => r && r.message.token !== '',
  });

  client.close();
}
```

---

## CZĘŚĆ 4: Najczęstsze problemy w Minikube

### Problem 1: "Connection refused" przy testowaniu gRPC

**Przyczyna:** Port forwarding nie jest aktywny lub używasz złego portu.

**Rozwiązanie:**
```bash
# Sprawdź, czy port-forward działa
ps aux | grep port-forward

# Jeśli nie, uruchom ponownie:
kubectl port-forward -n distributed-system svc/userservice 5185:80 &

# Sprawdź, czy port jest nasłuchiwany:
netstat -an | grep 5185
```

### Problem 2: "Protocol HTTP/1.1 not supported" w logach Kestrel

**Przyczyna:** Brak zmiennej `ASPNETCORE_HTTP_PROTOCOLS` w Deployment.

**Rozwiązanie:**
```bash
# Sprawdź zmienne środowiskowe poda:
kubectl get pod -n distributed-system -l app=userservice -o jsonpath='{.items[0].spec.containers[0].env[*].name}'

# Jeśli nie widzisz ASPNETCORE_HTTP_PROTOCOLS:
# 1. Dodaj zmienną do pliku .tf
# 2. Przebuduj obraz Docker (jeśli zmieniałeś kod):
eval $(minikube docker-env)
docker build -t userservice:latest src/UserService

# 3. Zastosuj zmiany Terraform:
cd k8s
terraform apply

# 4. Restartuj deployment:
kubectl rollout restart deployment/userservice -n distributed-system
```

### Problem 3: gRPC działa lokalnie, ale nie w Minikube

**Przyczyna:** Image w Minikube nie zawiera nowego kodu gRPC.

**Rozwiązanie:**
```bash
# 1. Upewnij się, że używasz Docker środowiska Minikube:
eval $(minikube docker-env)

# 2. Zbuduj obrazy ponownie:
docker build -t userservice:latest src/UserService
docker build -t productservice:latest src/ProductService
docker build -t orderservice:latest src/OrderService

# 3. Sprawdź, czy nowe obrazy są w Minikube:
minikube ssh
docker images | grep service
exit

# 4. Wymusz ponowne utworzenie podów (jeśli imagePullPolicy: Never):
kubectl delete pod -n distributed-system -l app=userservice
kubectl delete pod -n distributed-system -l app=productservice
kubectl delete pod -n distributed-system -l app=orderservice
```

### Problem 4: Minikube zabija się podczas testów obciążeniowych

**Przyczyna:** Za małe zasoby przydzielone Minikube.

**Rozwiązanie:**
```bash
# Sprawdź bieżące zasoby:
minikube config get memory
minikube config get cpus

# Zwiększ zasoby (wymaga restartu):
minikube stop
minikube start --cpus=4 --memory=8192 --disk-size=20g

# Dla testów k6 z dużym obciążeniem polecam minimum:
# --cpus=4 (4 rdzenie CPU)
# --memory=8192 (8GB RAM)
```

---

## CZĘŚĆ 5: Checklist przed rozpoczęciem testów

Zanim uruchomisz testy k6, upewnij się, że:

### ✅ Kod aplikacji:
- [ ] Dodałeś pakiety NuGet (Grpc.AspNetCore, itd.) do .csproj
- [ ] Utworzyłeś pliki .proto w `src/Protos/`
- [ ] Dodałeś implementacje `*GrpcService.cs` w każdym projekcie
- [ ] Zmodyfikowałeś `Program.cs` w każdym serwisie (AddGrpc, MapGrpcService)
- [ ] Zbudowałeś projekty lokalnie bez błędów (`dotnet build`)

### ✅ Terraform:
- [ ] Dodałeś `ASPNETCORE_HTTP_PROTOCOLS=Http1AndHttp2` do apps-user.tf
- [ ] Dodałeś tę samą zmienną do apps-order.tf
- [ ] Dodałeś tę samą zmienną do apps-product-scaling.tf
- [ ] Zastosowałeś zmiany (`terraform apply`)

### ✅ Docker w Minikube:
- [ ] Przełączyłeś na Docker środowisko Minikube (`eval $(minikube docker-env)`)
- [ ] Zbudowałeś wszystkie obrazy Docker z nowym kodem
- [ ] Zweryfikowałeś, że obrazy są w Minikube (`minikube ssh`, `docker images`)
- [ ] Restartowałeś deploymenty jeśli to konieczne

### ✅ Testy manualne:
- [ ] Port-forward działa dla wszystkich serwisów
- [ ] Rejestracja przez gRPC działa (grpcurl UserService/Register)
- [ ] Logowanie przez gRPC działa i zwraca token
- [ ] Lista produktów przez gRPC działa (grpcurl ProductService/GetAll)
- [ ] Utworzenie zamówienia przez gRPC działa (z tokenem JWT)
- [ ] REST API nadal działa (nie zepsułeś istniejącej funkcjonalności)

### ✅ Monitoring:
- [ ] Prometheus działa i zbiera metryki (`minikube service prometheus -n distributed-system --url`)
- [ ] Grafana działa i pokazuje dashboardy (`minikube service grafana -n distributed-system --url`)
- [ ] Widzisz metryki dla UserService, ProductService, OrderService w Prometheus

---

## CZĘŚĆ 6: Co dalej?

Po pomyślnym wdrożeniu gRPC w Minikube, następne kroki to:

1. **Testy jednostkowe gRPC:** Upewnij się, że każda metoda gRPC działa poprawnie
2. **Przygotowanie skryptów k6:** Utworzenie identycznych scenariuszy dla REST i gRPC
3. **Testy obciążeniowe:** Uruchomienie k6 i zebranie metryk
4. **Analiza wyników:** Porównanie latencji, throughput, użycia zasobów

Kiedy będziesz gotowy, mogę przygotować dla Ciebie:
- Skrypty k6 dla REST i gRPC
- Dashboard Grafana specjalnie dla porównania REST vs gRPC
- Szczegółową analizę wyników

---

## Podsumowanie: Minikube vs Produkcja

**Co jest identyczne:**
- Routing sieciowy (Kubernetes Service, DNS)
- Obsługa HTTP/2 i gRPC
- Load balancing
- Resource limits i HPA
- Prometheus i metryki

**Co jest inne:**
- Minikube = 1 węzeł, produkcja = wiele węzłów
- Minikube = lokalny storage, produkcja = distributed storage
- Minikube = brak HA (High Availability)

**Dla testów wydajności REST vs gRPC:** różnice są pomijalnie małe. Wszystkie aspekty związane z protokołem komunikacji (HTTP/1.1 vs HTTP/2, JSON vs Protobuf) są identyczne.

**Wniosek:** Minikube jest doskonałym środowiskiem do Twoich testów. Wyniki będą wiarygodne i przenoszalne na produkcję.
