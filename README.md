# 📦 System Rozproszony zbudowany w ASP.NET Core (.NET 8) – Praca Inżynierska

## 📘 Opis projektu

Projekt jest częścią pracy inżynierskiej pt. **„Analiza i optymalizacja wydajności systemów rozproszonych”**. Celem aplikacji jest implementacja rozproszonego systemu opartego na mikroserwisach, wdrożonego w środowisku Kubernetes, obsługującego scenariusz e-commerce z wykorzystaniem .NET oraz Apache Kafka.

Aplikacja pełni rolę środowiska testowego do analizy wydajności, skalowalności oraz odporności systemów rozproszonych.

---

## ⚙️ Stack technologiczny

- **.NET 8 / ASP.NET Core** – Web API (REST)
- **Entity Framework Core** – ORM (PostgreSQL)
- **MongoDB / Redis** – dane produktowe i cache
- **Apache Kafka** – przesyłanie zdarzeń
- **Docker** – konteneryzacja
- **Kubernetes** – orkiestracja mikroserwisów
- **Prometheus + Grafana** – monitoring
- **GitHub Actions** – CI/CD
- **k6** – testy wydajnościowe

---

## 🧱 Mikroserwisy

| Serwis                  | Funkcja                                           |
| ----------------------- | ------------------------------------------------- |
| **ApiGateway**          | Forwardowanie żądań REST między usługami          |
| **UserService**         | Rejestracja i uwierzytelnianie użytkowników (JWT) |
| **ProductService**      | Udostępnianie listy produktów                     |
| **OrderService**        | Składanie zamówień i emisja zdarzeń               |
| **NotificationService** | Reakcja na zdarzenia, logi, powiadomienia         |

---

## 📂 Struktura repozytorium

```
/src
  /ApiGatewayService
  /UserService
  /ProductService
  /OrderService
  /NotificationService
/docker
  Dockerfile dla każdego serwisu
/k8s
  apps-gateway.tf
/monitoring
  prometheus-config.yaml
  grafana-dashboards.json
/tests
  k6-load-test.js
  /integration-tests
/README.md
```

---

## 🚀 Uruchamianie lokalnie

### 1. Build i uruchomienie usług

```bash
docker-compose up --build
```

### 2. Dostępne endpointy

- `http://localhost:5000/api/user`
- `http://localhost:5000/api/product`
- `http://localhost:5000/api/order`

### 3. Uruchomienie w Kubernetes (np. Minikube)

```bash
kubectl apply -f ./k8s
```

---

## 📈 Monitoring i testy

📊 Dostęp do interfejsów:
Prometheus:

```bash

# W Minikube:
minikube service prometheus -n distributed-system

# Lub bezpośrednio:
kubectl port-forward -n distributed-system svc/prometheus 9090:9090
# Następnie otwórz: http://localhost:9090

```

Grafana:

```bash

# W Minikube:
minikube service grafana -n distributed-system

# Lub bezpośrednio:
kubectl port-forward -n distributed-system svc/grafana 3000:3000
# Następnie otwórz: http://localhost:3000

```

Metryki Prometheusa dostępne pod endpointem `/metrics` w każdym serwisie.

### k6 – testy obciążeniowe

```bash
k6 run tests/k6-load-test.js
```

---

## 📊 Wyniki i analiza

Wyniki testów oraz analiza wpływu zastosowanych optymalizacji znajdują się w **rozdziale 5 pracy inżynierskiej**. Zakres testów obejmuje:

- testy obciążeniowe (1000+ RPS),
- testy odpornościowe (awarie usług),
- obserwację autoskalowania w Kubernetesie,
- efekty migracji REST → gRPC.

---

## 👨‍🎓 Autor i promotor

- **Autor**: Grzegorz Banaszak
- **Promotor**: dr inż. Imię Nazwisko
- **Uczelnia**: Wydział Studiów Stosowanych  
  Kierunek: Informatyka  
  Specjalność: Inżynier aplikacji i systemów chmurowych

---

## 📝 Licencja

Projekt stworzony do celów edukacyjnych i dyplomowych. Wszelkie prawa zastrzeżone.
