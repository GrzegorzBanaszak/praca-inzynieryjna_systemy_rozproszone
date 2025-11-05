# Przewodnik: Konfiguracja API Gateway (YARP) dla gRPC
## Pełna integracja REST i gRPC przez jeden punkt wejścia

### Wprowadzenie - Dlaczego warto?

Konfigurowałeś API Gateway (YARP) do obsługi gRPC to świetna decyzja z kilku powodów. Po pierwsze, w środowisku produkcyjnym rzadko kiedy masz oddzielne endpointy dla REST i gRPC - zazwyczaj wszystko przechodzi przez jeden punkt wejścia (API Gateway), gdzie możesz zastosować jednolite polityki bezpieczeństwa, rate limiting, monitoring i logowanie. Po drugie, dla testów wydajnościowych lepiej jest mieć identyczną infrastrukturę dla obu protokołów - różnice w wydajności będą wynikać z samego protokołu (REST vs gRPC), a nie z architektury systemu.

W tym przewodniku pokażę Ci, jak skonfigurować YARP tak, żeby obsługiwał zarówno REST API (HTTP/1.1 + JSON) jak i gRPC (HTTP/2 + Protobuf) na tym samym porcie, z tym samym mechanizmem autentykacji JWT i tą samą logiką routingu.

### Jak YARP rozróżnia REST od gRPC

Zanim zaczniemy konfigurację, ważne jest zrozumienie, w jaki sposób YARP (lub jakikolwiek reverse proxy) może wiedzieć, czy przychodzące żądanie to REST czy gRPC.

**Mechanizm rozróżniania:**

Każde żądanie gRPC ma charakterystyczny nagłówek `Content-Type: application/grpc` (lub warianty jak `application/grpc+proto`). To jest standardowa część protokołu gRPC - każdy klient gRPC (czy to k6, czy grpcurl, czy aplikacja Go/Java/Python) automatycznie dodaje ten nagłówek. REST API natomiast używa `Content-Type: application/json` lub `application/x-www-form-urlencoded`.

YARP może sprawdzać nagłówki HTTP w konfiguracji Route. Dzięki temu możemy utworzyć dwa zestawy route:
- Routes bez sprawdzania Content-Type → obsługują REST
- Routes z wymogiem `Content-Type: application/grpc` → obsługują gRPC

Dodatkowo, ścieżki są inne. REST używa ścieżek typu `/api/user/login`, podczas gdy gRPC używa formatu `/{package}.{Service}/{Method}`, np. `/user.UserService/Login`. To dodatkowa wskazówka dla routingu.

### Architektura końcowa

Po implementacji zmian, Twoja architektura będzie wyglądać tak:

```
                        KLIENT (k6, grpcurl, curl)
                                 │
                                 │
                    ┌────────────┴────────────┐
                    │                         │
               REST │                         │ gRPC
       HTTP/1.1 JSON│                         │HTTP/2 Protobuf
                    │                         │
                    ▼                         ▼
              ┌─────────────────────────────────┐
              │         API Gateway             │
              │           (YARP)                │
              │                                 │
              │  Kestrel: HTTP/1.1 + HTTP/2    │
              │  Port: 80                       │
              │                                 │
              │  Routing na podstawie:          │
              │  - Path (/api/* vs /*.Service/*) │
              │  - Content-Type (JSON vs gRPC)  │
              └───────────┬─────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
     REST │          REST/gRPC        gRPC│
          │               │               │
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │  User    │   │ Product  │   │  Order   │
    │ Service  │   │ Service  │   │ Service  │
    │          │   │          │   │          │
    │HTTP/1+2  │   │HTTP/1+2  │   │HTTP/1+2  │
    └──────────┘   └──────────┘   └──────────┘
```

Wszystkie żądania - niezależnie czy REST czy gRPC - wchodzą przez ten sam Ingress i API Gateway. Gateway routuje je do odpowiednich serwisów. Każdy mikrouserwis obsługuje oba protokoły na tym samym porcie (dzięki `ASPNETCORE_HTTP_PROTOCOLS=Http1AndHttp2`).

### Krok 1: Aktualizacja appsettings.json w ApiGatewayService

Twój obecny `appsettings.json` zawiera tylko routes dla REST API. Musimy dodać nowe routes dla gRPC oraz nowe clustery ze specjalną konfiguracją HTTP/2.

**Kluczowe pojęcia w YARP:**
- **Route** - zasada routingu: "jeśli żądanie pasuje do tych kryteriów (path, nagłówki), przekieruj do tego clustera"
- **Cluster** - grupa backendów (destinations), które obsługują dany typ żądań
- **Transform** - opcjonalne przekształcenia ścieżki lub nagłówków przed przekazaniem do backendu

**Dodanie routes dla gRPC:**

W sekcji `ReverseProxy.Routes` dodaj nowe route dla każdego serwisu z obsługą gRPC. Skopiowałem dla Ciebie kompletną konfigurację do pliku `ApiGateway_appsettings_with_grpc.json`. Kluczowe fragmenty to:

```json
"grpc-user-route": {
  "ClusterId": "user-service-grpc",
  "Match": {
    "Path": "/user.UserService/{**method}",
    "Headers": [
      {
        "Name": "Content-Type",
        "Values": ["application/grpc"],
        "Mode": "Contains"
      }
    ]
  },
  "Transforms": []
}
```

**Wyjaśnienie tej konfiguracji:**

Path `/user.UserService/{**method}` to wzorzec, który pasuje do wszystkich wywołań gRPC na UserService. `{**method}` to catch-all parameter, który przechwytuje resztę ścieżki (np. `/Register`, `/Login`, `/GetProfile`).

Header matcher sprawdza, czy `Content-Type` zawiera `application/grpc`. Używamy "Contains" zamiast równości, bo pełny Content-Type gRPC może być `application/grpc`, `application/grpc+proto`, lub `application/grpc+json` w zależności od implementacji.

Transforms jest pustą listą, bo dla gRPC zwykle nie chcemy modyfikować ścieżki. gRPC clients oczekują konkretnych ścieżek zgodnych z plikiem .proto, więc przekazujemy je bez zmian.

**Dodanie clusterów dla gRPC:**

W sekcji `ReverseProxy.Clusters` dodaj nowe clustery, które wskazują na te same serwisy (userservice, productservice, orderservice), ale z konfiguracją HTTP/2:

```json
"user-service-grpc": {
  "Destinations": {
    "userservice-grpc": { 
      "Address": "http://userservice"
    }
  },
  "HttpRequest": {
    "Version": "2.0",
    "VersionPolicy": "RequestVersionExact"
  }
}
```

**Dlaczego oddzielne clustery?**

Technicznie moglibyśmy używać tych samych clusterów dla REST i gRPC, ale rozdzielenie ich daje nam większą elastyczność. Na przykład, możemy później dodać różne timeouty dla gRPC (które często są dłuższe ze względu na streaming), lub skierować ruch gRPC do innych instancji serwisu zoptymalizowanych pod HTTP/2.

Konfiguracja `"HttpRequest"` jest kluczowa. `"Version": "2.0"` mówi YARP, żeby używał HTTP/2 dla połączeń z tym clusterem. `"VersionPolicy": "RequestVersionExact"` wymusza używanie dokładnie HTTP/2 - nie pozwoli na fallback do HTTP/1.1. To ważne, bo gRPC wymaga HTTP/2 bezwzględnie.

### Krok 2: Modyfikacja Program.cs w ApiGatewayService

Teraz musimy zaktualizować kod startowy aplikacji, żeby Kestrel (wbudowany serwer HTTP w ASP.NET Core) obsługiwał HTTP/2. Skopiowałem kompletną wersję do `ApiGateway_Program_with_grpc.cs`.

**Konfiguracja Kestrel dla HTTP/2:**

Na początku `Program.cs`, zaraz po utworzeniu `builder`, dodaj:

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.ConfigureEndpointDefaults(listenOptions =>
    {
        listenOptions.Protocols = Microsoft.AspNetCore.Server.Kestrel.Core.HttpProtocols.Http1AndHttp2;
    });
});
```

**Co to robi?**

Domyślnie w środowisku bez HTTPS (czyli HTTP plaintext, który używasz w Kubernetes), Kestrel może nie mieć włączonego HTTP/2. To dlatego, że HTTP/2 był pierwotnie zaprojektowany dla HTTPS (z TLS). Jednak można używać HTTP/2 bez szyfrowania (tzw. "h2c" - HTTP/2 cleartext), i to właśnie potrzebujemy dla komunikacji wewnątrz klastra Kubernetes.

Ustawienie `HttpProtocols.Http1AndHttp2` włącza obsługę obu protokołów na tym samym porcie. Kestrel automatycznie wykryje, czy klient nawiązuje połączenie HTTP/1.1 czy HTTP/2 (na podstawie preface frame w HTTP/2) i wybierze odpowiedni protokół.

**Obsługa JWT dla gRPC:**

Kolejna ważna zmiana to w konfiguracji JWT Bearer:

```csharp
options.Events = new JwtBearerEvents
{
    OnMessageReceived = context =>
    {
        var contentType = context.Request.ContentType;
        if (!string.IsNullOrEmpty(contentType) && contentType.StartsWith("application/grpc"))
        {
            var authHeader = context.Request.Headers["authorization"].FirstOrDefault();
            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
            {
                context.Token = authHeader.Substring("Bearer ".Length).Trim();
            }
        }
        return Task.CompletedTask;
    }
};
```

**Dlaczego to jest potrzebne?**

W HTTP/1.1 (REST) nagłówki są case-insensitive, więc `Authorization` i `authorization` to to samo. W HTTP/2 (gRPC) wszystkie nagłówki są lowercase. Niektóre implementacje klientów gRPC wysyłają token w nagłówku `authorization` (małe litery), a nie `Authorization` (wielka litera).

Domyślny middleware JWT w ASP.NET Core szuka w `Authorization` (wielka litera). Event `OnMessageReceived` pozwala nam przechwycić żądanie i wyciągnąć token również z lowercase wariantu, jeśli wykryjemy, że to żądanie gRPC (po Content-Type).

### Krok 3: Modyfikacja Terraform dla ApiGateway

Twój manifest Kubernetes dla ApiGateway (`k8s/apps-gateway.tf`) również potrzebuje małej zmiany - dodania zmiennej środowiskowej dla HTTP/2.

W sekcji Deployment, w containerze, dodaj:

```hcl
env {
  name  = "ASPNETCORE_HTTP_PROTOCOLS"
  value = "Http1AndHttp2"
}
```

**Czy to nie jest duplikacja?**

Dobra obserwacja! Konfigurujemy HTTP/2 zarówno w kodzie (Program.cs przez ConfigureKestrel) jak i przez zmienną środowiskową. W praktyce, zmienna środowiskowa może nadpisać konfigurację z kodu, więc ustawienie jej upewnia się, że nawet jeśli ktoś usunie kod z Program.cs, HTTP/2 nadal będzie włączony.

Dla spójności z innymi serwisami (UserService, ProductService, OrderService), gdzie używamy wyłącznie zmiennej środowiskowej, dobrze jest mieć ją również tutaj.

### Krok 4: Weryfikacja Service mesh - ClusterIP vs NodePort

Tutaj pojawia się interesujące rozważanie dla Twojego środowiska Minikube. Gdy wszystko przechodzi przez API Gateway, czy nadal potrzebujesz NodePort dla serwisów backend (UserService, ProductService, OrderService)?

**Odpowiedź zależy od strategii testowania:**

**Opcja A: API Gateway dla wszystkiego (produkcyjne podejście)**
- Wszystkie żądania (REST i gRPC) idą przez Ingress → API Gateway → Services
- Backend services mają typ ClusterIP (dostępne tylko wewnątrz klastra)
- To jest dokładnie jak w produkcji - klienci nigdy nie łączą się bezpośrednio z microservicami
- W testach k6 używasz tylko jednego URL: `http://distributed.local` (lub IP z Ingress)

**Opcja B: Dual access dla elastyczności testów (developer-friendly)**
- API Gateway dla "normalnego" flow (REST i gRPC przez gateway)
- NodePort dla bezpośredniego dostępu (gdy chcesz przetestować sam serwis bez gateway)
- Backend services mają typ NodePort
- Daje Ci możliwość porównania:
  - REST przez gateway vs REST bezpośredni
  - gRPC przez gateway vs gRPC bezpośredni
  - Pomiar overhead'u wprowadzanego przez API Gateway

**Moja rekomendacja dla Twoich testów:**

Polecałbym **Opcję A** - wszystko przez API Gateway. Dlaczego? Bo w prawdziwej produkcji tak właśnie będzie działać. Overhead API Gateway będzie jednakowy dla REST i gRPC (routowanie, sprawdzanie nagłówków, przekazanie), więc porównanie będzie uczciwe. Dodatkowo, upraszcza to konfigurację testów - masz jeden endpoint dla wszystkiego.

Jeśli wybierzesz Opcję A, możesz zmienić Services z powrotem na ClusterIP:

```hcl
# W k8s/apps-user.tf
resource "kubernetes_service_v1" "user" {
  spec {
    type = "ClusterIP"  # Zmień z NodePort z powrotem na ClusterIP
    selector = { app = "userservice" }
    # ...
  }
}
```

API Gateway pozostaje z NodePort (lub może być LoadBalancer/Ingress), bo to jest jedyny punkt wejścia z zewnątrz.

### Krok 5: Testowanie konfiguracji

Po zastosowaniu wszystkich zmian, przetestuj obie ścieżki (REST i gRPC) przez API Gateway.

**Setup w Minikube:**

```bash
# Przebuduj obraz ApiGateway z nowymi zmianami
& minikube -p minikube docker-env | Invoke-Expression
docker build -t apigatewayservice:latest .\src\ApiGatewayService

# Zastosuj zmiany Terraform
cd k8s
terraform apply

# Sprawdź czy pod się uruchomił
kubectl get pods -n distributed-system
kubectl logs -n distributed-system <apigateway-pod-name>

# Powinieneś zobaczyć w logach:
# "Now listening on: http://[::]:80"
# "Application started. Press Ctrl+C to shut down."
```

**Test REST API przez API Gateway:**

```bash
# Sprawdź URL Ingress (powinien już działać)
curl http://distributed.local/api/user/register `
  -H "Content-Type: application/json" `
  -d '{"username":"testuser","password":"pass123"}'

# Powinno zwrócić: 200 OK (lub 400 jeśli user już istnieje)
```

**Test gRPC przez API Gateway:**

Teraz najciekawsza część - test gRPC, ale przez API Gateway zamiast bezpośrednio.

```bash
# Uzyskaj IP Minikube (jeśli używasz Ingress)
minikube ip
# Lub jeśli API Gateway ma NodePort, użyj:
minikube service apigateway -n distributed-system --url

# Test przez grpcurl
# UWAGA: Teraz łączymy się z API Gateway, nie bezpośrednio z UserService!
grpcurl -plaintext `
  -d '{"username":"grpcuser","password":"grpcpass"}' `
  distributed.local:80 user.UserService/Register

# Alternatywnie, jeśli distributed.local nie rozwiązuje się:
$GATEWAY_IP = minikube ip
grpcurl -plaintext `
  -d '{"username":"grpcuser","password":"grpcpass"}' `
  ${GATEWAY_IP}:80 user.UserService/Register
```

**Co się dzieje pod spodem?**

Gdy wywołujesz `user.UserService/Register`, grpcurl tworzy żądanie HTTP/2 z:
- Path: `/user.UserService/Register`
- Content-Type: `application/grpc`
- Method: POST

API Gateway (YARP) otrzymuje to żądanie i:
1. Sprawdza routes - znajduje `grpc-user-route` (bo path pasuje i Content-Type to `application/grpc`)
2. Wybiera cluster `user-service-grpc`
3. Tworzy połączenie HTTP/2 do `http://userservice` (wewnątrz klastra)
4. Przekazuje żądanie bez zmian (bo Transforms jest puste)
5. UserService odpowiada przez gRPC
6. YARP przekazuje odpowiedź z powrotem do klienta

Cały proces jest transparentny - UserService nie wie, że jest za proxy. Dla niego wygląda to jak bezpośrednie połączenie gRPC.

**Debugging - co jeśli nie działa?**

Jeśli grpcurl zwraca błąd, sprawdź logi API Gateway:

```bash
kubectl logs -n distributed-system <apigateway-pod> --tail=50
```

Typowe problemy:
- "Connection refused" - API Gateway nie obsługuje HTTP/2 (sprawdź ConfigureKestrel)
- "404 Not Found" - routing nie pasuje (sprawdź ścieżkę, powinna być `/user.UserService/Register`, nie `/api/user/register`)
- "Unimplemented" - żądanie dotarło do UserService, ale serwis nie ma zaimplementowanej metody gRPC (sprawdź czy dodałeś UserGrpcService i MapGrpcService)

### Krok 6: Porównanie metryk - gateway overhead

Teraz, gdy wszystko przechodzi przez API Gateway, możesz zmierzyć, jaki overhead wprowadza proxy. To cenne dane!

**Metryki do zbierania:**

1. **Latencja w API Gateway:**
   - Prometheus ma już metryki od YARP: `http_request_duration_seconds`
   - Możesz zobaczyć, ile czasu żądanie spędza w gateway

2. **Latencja w backend service:**
   - To samo, ale dla UserService/ProductService/OrderService
   - Różnica między latencją w gateway a latencją w serwisie = overhead proxy

3. **Throughput:**
   - `http_requests_received_total` - ile żądań przechodzi przez gateway
   - Porównaj z `http_requests_received_total` w backend services - powinny być identyczne (każde żądanie gateway = jedno żądanie backend)

**Przykładowe zapytania Prometheus:**

```promql
# Średnia latencja w API Gateway (wszystkie żądania)
rate(http_request_duration_seconds_sum{job="apigateway"}[5m]) 
/ 
rate(http_request_duration_seconds_count{job="apigateway"}[5m])

# Średnia latencja w UserService
rate(http_request_duration_seconds_sum{job="userservice"}[5m]) 
/ 
rate(http_request_duration_seconds_count{job="userservice"}[5m])

# Overhead = różnica
(rate(http_request_duration_seconds_sum{job="apigateway"}[5m]) 
/ 
rate(http_request_duration_seconds_count{job="apigateway"}[5m]))
-
(rate(http_request_duration_seconds_sum{job="userservice"}[5m]) 
/ 
rate(http_request_duration_seconds_count{job="userservice"}[5m]))
```

Typowo, reverse proxy dodaje 1-5ms latencji. Jeśli widzisz więcej, może być problem z konfiguracją (np. zbyt małe limity CPU/memory dla API Gateway).

### Krok 7: Aktualizacja testów k6

Gdy API Gateway działa dla obu protokołów, testy k6 będą prostsze - używają tego samego base URL.

**Dla REST (bez zmian):**
```javascript
const BASE_URL = 'http://distributed.local';
http.post(`${BASE_URL}/api/user/register`, payload);
```

**Dla gRPC (teraz przez gateway):**
```javascript
const GRPC_URL = 'distributed.local:80'; // Zamiast bezpośredniego IP:port serwisu
const client = new grpc.Client();
client.connect(GRPC_URL, { plaintext: true });
```

To sprawia, że porównanie jest bardziej sprawiedliwe - oba protokoły przechodzą przez tę samą infrastrukturę.

### Podsumowanie - Co osiągnęliśmy

Po implementacji tych zmian:

1. **Jeden punkt wejścia** - wszystkie żądania (REST i gRPC) idą przez API Gateway
2. **Autentykacja JWT działa** - dla obu protokołów, obsługa både `Authorization` (REST) i `authorization` (gRPC)
3. **Routing na podstawie Content-Type** - YARP inteligentnie rozróżnia REST od gRPC
4. **HTTP/2 end-to-end** - od klienta przez gateway do backend service
5. **Monitoring** - Prometheus zbiera metryki dla całego flow
6. **Produkcyjne podejście** - architektura przypomina prawdziwy deployment

**Co dalej?**

Teraz możesz przejść do testów k6 z pełną pewnością, że architektura jest solidna i realistyczna. Porównanie REST vs gRPC będzie uczciwe, bo oba protokoły przechodzą przez tę samą infrastrukturę. Różnice w wydajności będą wynikać z protokołu (JSON vs Protobuf, HTTP/1.1 vs HTTP/2), a nie z różnic w routing.

Jeśli chcesz, mogę teraz przygotować szczegółowe skrypty k6 dla obu scenariuszy, które wykorzystają tę nową konfigurację API Gateway.
