# Rozproszony System E-commerce w .NET 8

## Opis projektu

Projekt stanowi implementację rozproszonego systemu e-commerce w architekturze mikroserwisowej. System zbudowano w ramach pracy inżynierskiej pt. „Analiza i optymalizacja wydajności systemów rozproszonych". Celem aplikacji było stworzenie środowiska testowego do badań nad wydajnością, skalowalnością i odpornością mikroserwisów w środowisku Kubernetes.

System składa się z kilku niezależnych usług komunikujących się zarówno synchronicznie (REST/gRPC) jak i asynchronicznie poprzez kolejkę zdarzeń Apache Kafka. Każdy mikroserwis exposes endpoint `/metrics` oraz sondę żywotności `/healthz` ułatwiające obserwowalność.

## Architektura i mikroserwisy

Poniższa tabela przedstawia podstawowe usługi wchodzące w skład systemu oraz ich odpowiedzialności. Komponenty są odseparowane i mogą być niezależnie skalowane.

| Serwis                  | Krótki opis                                                                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ApiGateway**          | Pełni rolę bramy API – weryfikuje nagłówki i tokeny JWT, autoryzuje użytkowników i przekazuje zapytania do odpowiednich usług zaplecza.                                                                                                          |
| **UserService**         | Odpowiada za rejestrację i logowanie użytkowników (`POST /api/auth/register`, `POST /api/auth/login`) oraz udostępnianie profilu pod endpointem `GET /api/profile/me`. Dane przechowywane są w bazie PostgreSQL z użyciem Entity Framework Core. |
| **ProductService**      | Umożliwia pobieranie listy produktów (`GET /api/product`) oraz szczegółów wybranego produktu (`GET /api/product/{id}`) i dodawanie nowych wpisów (`POST /api/product`). Dane utrzymywane są w MongoDB.                                           |
| **OrderService**        | Umożliwia składanie zamówień (`POST /api/orders`) oraz przeglądanie własnej historii (`GET /api/orders`). Po zapisaniu zamówienia publikowane jest zdarzenie OrderPlaced na temat orders w Kafka, a dane utrzymywane są w PostgreSQL.            |
| **NotificationService** | Konsument zdarzeń – subskrybuje temat orders w Kafka i reaguje na pojawienie się nowych zamówień, np. generując logi lub wysyłając powiadomienia e-mail/SMS.                                                                                     |

Dodatkowe szczegóły dotyczące implementacji usług (np. schematy autoryzacji, konfiguracja repozytoriów, mapowanie DTO, itp.) znajdują się w rozdziale 4 pracy inżynierskiej.

## Stack technologiczny

System wykorzystuje nowoczesne technologie chmurowe i narzędzia, m.in.:

- **.NET 8 / ASP.NET Core** – tworzenie usług Web API (REST/gRPC)
- **Entity Framework Core (PostgreSQL)** oraz **MongoDB/Redis** – persystencja danych
- **Apache Kafka** – asynchroniczne przesyłanie zdarzeń
- **Docker** – konteneryzacja aplikacji
- **Kubernetes** – orkiestracja mikroserwisów
- **Prometheus + Grafana** – monitorowanie i wizualizacja metryk
- **k6** – testy wydajnościowe
- **Terraform** – definiowanie infrastruktury jako kodu

## Struktura repozytorium

Struktura katalogów jest uporządkowana w sposób umożliwiający łatwe zrozumienie składowych projektu:

```
/src
  /ApiGatewayService
  /UserService
  /ProductService
  /OrderService
  /NotificationService
/docker
  # osobne Dockerfile dla każdej usługi
/k8s
  # definicje manifestów Kubernetes i Terraform
/monitoring
  prometheus-config.yaml
  grafana-dashboards.json
/tests
  k6-load-test.js
  /integration-tests
```

## Konteneryzacja i orkiestracja

Każdy mikroserwis jest pakowany do osobnego obrazu Docker przy użyciu dwustopniowego procesu: najpierw kompilacja na bazie `mcr.microsoft.com/dotnet/sdk:8.0`, a następnie uruchomienie na lżejszym obrazie `mcr.microsoft.com/dotnet/aspnet:8.0`. Konteneryzacji poddano również zależności systemu (PostgreSQL, MongoDB, Kafka), których konfiguracja przekazywana jest jako zmienne środowiskowe.

W projekcie wykorzystano Terraform do deklaratywnego zarządzania zasobami Kubernetes – definicje Deployment, Service oraz konfiguracje baz danych są opisane w plikach `*.tf`. Taka metoda umożliwia łatwe odtworzenie infrastruktury i kontrolę wersji.

## Uruchamianie lokalne

### 1. Budowanie i uruchamianie usług

Aby uruchomić system w środowisku deweloperskim z Minikube, należy najpierw skonfigurować środowisko Docker, a następnie zbudować obrazy poszczególnych serwisów:

```powershell
minikube -p minikube docker-env | Invoke-Expression
docker build -t userservice:latest         .\src\UserService
docker build -t productservice:latest      .\src\ProductService
docker build -t orderservice:latest        .\src\OrderService
docker build -t notificationservice:latest .\src\NotificationService
docker build -t apigatewayservice:latest   .\src\ApiGatewayService
```

### 2. Wdrożenie systemu z wykorzystaniem Terraform

Po zbudowaniu obrazów Docker, należy wdrożyć system w klastrze Kubernetes przy użyciu Terraform:

```bash
cd k8s
terraform init
terraform plan
terraform apply -auto-approve
```

Terraform automatycznie utworzy:

- Namespace `distributed-system`
- Deploymenty i Service dla wszystkich mikroserwisów (UserService, ProductService, OrderService, NotificationService, ApiGateway)
- Bazy danych (PostgreSQL dla UserService i OrderService, MongoDB dla ProductService)
- Kafka (RedPanda) do obsługi zdarzeń asynchronicznych
- Ingress dla ApiGateway
- System monitoringu (Prometheus + Grafana)

Po zakończeniu wdrożenia, uruchom tunel Minikube, aby uzyskać dostęp do usług:

```bash
minikube tunnel
```

### 3. Dostępne endpointy API

Po uruchomieniu wszystkie żądania przechodzą przez ApiGateway dostępny pod adresem `http://distributed.local` (lub przez `minikube tunnel`). System udostępnia następujące endpointy:

#### Autoryzacja i użytkownicy (UserService)

**Rejestracja użytkownika:**

```
POST /api/user/register
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
```

**Logowanie:**

```
POST /api/user/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}

Odpowiedź: { "token": "JWT_TOKEN" }
```

**Profil użytkownika (wymaga autoryzacji):**

```
GET /api/user/me
Authorization: Bearer {JWT_TOKEN}
```

#### Produkty (ProductService)

**Lista wszystkich produktów:**

```
GET /api/product
```

**Szczegóły produktu:**

```
GET /api/product/{id}
```

**Dodanie nowego produktu:**

```
POST /api/product
Content-Type: application/json

{
  "name": "string",
  "price": 0.00,
  "stock": 0
}
```

#### Zamówienia (OrderService - wymaga autoryzacji)

**Złożenie zamówienia:**

```
POST /api/order
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "productId": "guid",
  "quantity": 0
}
```

**Historia zamówień użytkownika:**

```
GET /api/order
Authorization: Bearer {JWT_TOKEN}
```

#### Dokumentacja Swagger

Każdy serwis udostępnia dokumentację Swagger:

- UserService: `http://userservice/swagger`
- ProductService: `http://productservice/swagger`
- OrderService: `http://orderservice/swagger`

## Monitoring i testy

Dostęp do interfejsów monitoringu i wyników testów możliwy jest za pomocą narzędzi opisanych poniżej:

- **Prometheus** – uruchomione w klastrze Kubernetes; usługa może być wystawiona poprzez `minikube service prometheus -n distributed-system` lub `kubectl port-forward` na port 9090.

- **Grafana** – w podobny sposób dostępne są prekonfigurowane dashboardy; można je otworzyć po wykonaniu `minikube service grafana` lub `kubectl port-forward` na port 3000.

Każdy serwis wystawia metryki pod endpointem `/metrics` oraz sondę zdrowotną `/healthz`.

Do przeprowadzenia testów obciążeniowych użyto **k6**. Szkrypt `k6-load-test.js` definiuje scenariusze wysokiej liczby zapytań (1000+ RPS) i scenariusze awarii. Testy mierzą m.in. czas odpowiedzi, przepustowość i reakcję systemu na skalowanie w Kubernetesie.

## Wyniki i analiza

Szczegółowa analiza wyników testów (m.in. porównanie komunikacji REST vs gRPC, obserwacja autoskalowania, reakcja na awarie) została opisana w rozdziale 5 pracy inżynierskiej. W niniejszym repozytorium zamieszczono jedynie skrypty testowe; wyniki można wygenerować samodzielnie uruchamiając k6.

## Autor i promotor

- **Autor:** Grzegorz Banaszak
- **Promotor:** mgr inż. Mateusz Hyk
- **Uczelnia:** Wydział Studiów Stosowanych, kierunek Informatyka – specjalność Inżynier aplikacji i systemów chmurowych

## Licencja

Projekt został przygotowany na potrzeby pracy dyplomowej i jest udostępniony wyłącznie w celach edukacyjnych. Wszelkie prawa zastrzeżone.
