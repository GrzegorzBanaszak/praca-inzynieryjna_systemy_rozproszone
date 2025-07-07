# 📦 System Rozproszony zbudowany w ASP.NET Core (.NET 9) – Praca Inżynierska

## 📘 Opis projektu

Projekt jest częścią pracy inżynierskiej pt. **„Analiza i optymalizacja wydajności systemów rozproszonych”**. Celem aplikacji jest implementacja rozproszonego systemu opartego na mikroserwisach, wdrożonego w środowisku Kubernetes, obsługującego scenariusz e-commerce z wykorzystaniem .NET oraz Apache Kafka.

Aplikacja pełni rolę środowiska testowego do analizy wydajności, skalowalności oraz odporności systemów rozproszonych.

---

## ⚙️ Stack technologiczny

- **.NET 9 / ASP.NET Core** – Web API (REST)
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
  deployment.yaml
  service.yaml
  ingress.yaml
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

- **Prometheus**: [http://localhost:9090](http://localhost:9090)
- **Grafana**: [http://localhost:3000](http://localhost:3000)  
  _(login: admin / hasło: admin)_

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
