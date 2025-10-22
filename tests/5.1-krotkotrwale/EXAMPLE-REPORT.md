# Raport z testu 5.1 - Przykład

## Informacje podstawowe

- **Data testu:** 2025-01-22 14:30:45
- **Wykonawca:** Grzegorz Banaszak
- **Środowisko:** Minikube (Local)
- **Wersja aplikacji:** 1.0.0
- **Konfiguracja:** 1 replica per service, 4 CPU, 8GB RAM

## Konfiguracja testu

### Parametry testu k6
- **Liczba VU:** 100
- **Czas trwania:** 30 sekund (test właściwy)
- **Ramp-up:** 10 sekund
- **Cool-down:** 5 sekund
- **Łączny czas:** 50 sekund

### Testowane endpointy
1. `GET /api/product` - lista wszystkich produktów
2. `GET /api/product/:id` - szczegóły produktu

### Środowisko testowe
- **Kubernetes:** v1.28.3
- **Minikube:** v1.32.0
- **Docker:** 24.0.7
- **k6:** v0.48.0

## Wyniki testu

### Metryki HTTP (k6)

| Metryka | Wartość | Próg | Status |
|---------|---------|------|--------|
| Całkowite żądania | 8,400 | - | ℹ️ |
| Żądania/sekundę | 168.0 | > 50 | ✅ |
| Średni czas odpowiedzi | 145.67 ms | - | ✅ |
| Mediana | 132.45 ms | - | ✅ |
| P90 | 234.56 ms | - | ✅ |
| P95 | 287.34 ms | < 500ms | ✅ |
| P99 | 356.78 ms | - | ✅ |
| Max | 456.78 ms | - | ✅ |
| Współczynnik błędów | 0.00% | < 5% | ✅ |

### Metryki Prometheus

#### Przepustowość (żądania/s)

| Serwis | Wartość |
|--------|---------|
| ApiGateway | 168.45 |
| ProductService | 168.45 |

#### Czasy odpowiedzi P95 (ms)

| Serwis | Wartość |
|--------|---------|
| ApiGateway | 295 |
| ProductService | 287 |

#### Wykorzystanie zasobów

**CPU Usage (%)**

| Serwis | Użycie | Status |
|--------|--------|--------|
| ProductService | 45.3% | ✅ OK |
| ApiGateway | 23.8% | ✅ OK |
| MongoDB | 12.4% | ✅ OK |
| UserService | 5.2% | ✅ OK |
| OrderService | 3.1% | ✅ OK |

**Memory Usage (MB)**

| Serwis | Użycie | Status |
|--------|--------|--------|
| MongoDB | 234.5 | ✅ OK |
| ProductService | 156.7 | ✅ OK |
| ApiGateway | 89.3 | ✅ OK |
| UserService | 78.4 | ✅ OK |
| OrderService | 95.2 | ✅ OK |

### Status serwisów

| Serwis | Status | Uptime |
|--------|--------|--------|
| ApiGateway | ✅ UP | 100% |
| ProductService | ✅ UP | 100% |
| UserService | ✅ UP | 100% |
| OrderService | ✅ UP | 100% |
| NotificationService | ✅ UP | 100% |
| MongoDB | ✅ UP | 100% |
| PostgreSQL (User) | ✅ UP | 100% |
| PostgreSQL (Order) | ✅ UP | 100% |
| Redpanda | ✅ UP | 100% |

## Analiza wyników

### Przepustowość

**Wynik:** 168 żądań/sekundę

**Ocena:** ✅ Dobry wynik

**Interpretacja:**
- System bez problemu obsługuje 168 req/s przy 100 równoczesnych użytkownikach
- Przekroczono wymagany próg minimalny (50 req/s) o 236%
- Przy obecnej konfiguracji (1 replica) wynik jest zadowalający
- Potencjał skalowania: przy 3 replikach oczekujemy ~450-500 req/s

### Opóźnienia

**Wynik:** P95 = 287.34ms, P99 = 356.78ms

**Ocena:** ✅ Bardzo dobry wynik

**Interpretacja:**
- 95% żądań obsłużonych poniżej 300ms - doskonały wynik
- P99 poniżej 400ms - system stabilny
- Brak znaczących outlierów (max niewiele wyższy niż P99)
- Rozkład czasów jest normalny (mediana ≈ średnia)

**Rozkład opóźnień:**
```
Min: 45ms    [====]
P50: 132ms   [========]
P90: 235ms   [============]
P95: 287ms   [==============]
P99: 357ms   [=================]
Max: 457ms   [==================]
```

### Stabilność

**Wynik:** 0% błędów, 100% uptime

**Ocena:** ✅ Doskonały wynik

**Interpretacja:**
- Brak błędów podczas całego testu
- Wszystkie serwisy dostępne przez cały czas
- Brak restartów podów
- System stabilny przy tym poziomie obciążenia

### Wykorzystanie zasobów

**Ocena:** ✅ Optymalne

**Interpretacja:**

**CPU:**
- ProductService (45.3%) - największe obciążenie, ale daleko od limitu
- Pozostałe serwisy poniżej 25% - duża rezerwa
- Brak throttlingu
- **Wniosek:** Obecna konfiguracja CPU jest wystarczająca

**Pamięć:**
- Wszystkie serwisy w normie
- MongoDB (234.5 MB) - standardowe zużycie dla cache
- .NET serwisy (80-160 MB) - typowe wartości
- Brak wycieków pamięci (stabilne wartości)
- **Wniosek:** Obecna konfiguracja RAM jest wystarczająca

## Identyfikacja wąskich gardeł

### 1. ProductService (CPU: 45.3%)

**Analiza:**
- Największe obciążenie spośród serwisów aplikacyjnych
- Bezpośrednio obsługuje wszystkie zapytania o produkty
- Każde żądanie wymaga:
  - Deserializacji zapytania HTTP
  - Zapytania do MongoDB
  - Serializacji odpowiedzi JSON

**Rekomendacje:**
1. **Krótkoterminowe:**
   - Dodać cache (Redis) dla listy produktów
   - Zaimplementować pagination dla `GET /api/product`
   - Dodać indeksy w MongoDB

2. **Długoterminowe:**
   - Skalować do 3 replik
   - Rozważyć read replicas dla MongoDB
   - Dodać CDN dla statycznych danych

### 2. MongoDB (CPU: 12.4%)

**Analiza:**
- Obecnie NIE jest wąskim gardłem
- Niskie obciążenie przy obecnym poziomie ruchu
- Brak indeksów na często używanych polach

**Rekomendacje:**
1. Dodać indeksy:
   ```javascript
   db.Products.createIndex({ "name": 1 })
   db.Products.createIndex({ "price": 1, "stock": 1 })
   ```

2. Przy większym obciążeniu rozważyć:
   - MongoDB Replica Set
   - Sharding (dla bardzo dużych kolekcji)

### 3. Komunikacja sieciowa (średnie opóźnienie: 145ms)

**Analiza:**
- Komunikacja ApiGateway → ProductService → MongoDB dodaje opóźnienie
- W środowisku lokalnym (Minikube) jest to normalne
- Każde żądanie przechodzi przez 3 hopy

**Rekomendacje:**
1. **Dla produkcji:**
   - Użyć Service Mesh (Istio/Linkerd)
   - Włączyć HTTP/2 i gRPC
   - Optymalizować routing w klastrze

## Porównanie z wymaganiami

| Wymaganie | Oczekiwana wartość | Wynik testu | Status |
|-----------|-------------------|-------------|--------|
| P95 latency | < 500ms | 287.34ms | ✅ Spełnione (43% rezerwy) |
| Error rate | < 5% | 0% | ✅ Spełnione |
| Throughput | > 50 req/s | 168 req/s | ✅ Spełnione (236% więcej) |
| Availability | 100% | 100% | ✅ Spełnione |
| CPU usage | < 80% | max 45.3% | ✅ Spełnione |
| Memory stable | Tak | Tak | ✅ Spełnione |

**Podsumowanie:** ✅ Wszystkie wymagania spełnione

## Rekomendacje

### Krótkoterminowe (1-2 tygodnie)

1. **Implementacja cache (Redis)**
   - **Priorytet:** Wysoki
   - **Oczekiwany efekt:** Redukcja latency o 50-70%, zwiększenie throughput o 200-300%
   - **Effort:** Średni (2-3 dni)
   ```yaml
   # Cache dla ProductService
   - Lista produktów: TTL 5 minut
   - Pojedynczy produkt: TTL 10 minut
   ```

2. **Dodanie indeksów MongoDB**
   - **Priorytet:** Wysoki
   - **Oczekiwany efekt:** Redukcja query time o 30-40%
   - **Effort:** Niski (1 dzień)
   ```javascript
   db.Products.createIndex({ "name": 1 })
   db.Products.createIndex({ "price": 1, "stock": 1 })
   ```

3. **Pagination dla API**
   - **Priorytet:** Średni
   - **Oczekiwany efekt:** Mniejsze payloady, szybsza serializacja
   - **Effort:** Średni (2 dni)
   ```
   GET /api/product?page=1&pageSize=20
   ```

### Długoterminowe (1-3 miesiące)

1. **Skalowanie horyzontalne**
   - Zwiększyć replicas dla ProductService do 3
   - Oczekiwana przepustowość: ~450-500 req/s
   - Włączyć auto-scaling (HPA)

2. **MongoDB Replica Set**
   - Skonfigurować 3-node replica set
   - Odczyt z secondary nodes
   - Zwiększona dostępność i throughput

3. **Service Mesh (Istio)**
   - Lepsza komunikacja między serwisami
   - Circuit breakers, retry policies
   - Mniejsze opóźnienia

4. **Monitoring i alerting**
   - Dodać alerty dla:
     - CPU > 80%
     - Latency P95 > 500ms
     - Error rate > 5%
     - Availability < 99%

## Wnioski

### Mocne strony systemu

1. ✅ **Bardzo dobra stabilność** - brak błędów, 100% uptime
2. ✅ **Niskie opóźnienia** - 95% żądań < 300ms
3. ✅ **Efektywne wykorzystanie zasobów** - duża rezerwa mocy
4. ✅ **Dobra architektura** - separacja serwisów działa prawidłowo
5. ✅ **Skalowalność** - duży potencjał do zwiększenia przepustowości

### Obszary do poprawy

1. ⚠️ **Brak cachowania** - każde żądanie idzie do bazy
2. ⚠️ **Brak optymalizacji MongoDB** - brak indeksów
3. ⚠️ **Pojedyncze repliki** - brak redundancji
4. ⚠️ **Brak pagination** - duże payloady przy dużej liczbie produktów

### Gotowość do produkcji

**Obecny stan:** ⚠️ Gotowy do MVP / staging

**Do produkcji potrzebne:**
- ✅ Cache (Redis)
- ✅ Indeksy w MongoDB
- ✅ Skalowanie do 3 replik
- ✅ MongoDB Replica Set
- ✅ Monitoring i alerting
- ✅ Backup i disaster recovery

**Szacowany czas wdrożenia:** 4-6 tygodni

## Następne kroki

1. ✅ **Test 5.1 zakończony** - przejść do analizy wyników
2. 📋 **Wdrożyć cache** (Redis) - przed testem 5.5
3. 📋 **Dodać indeksy** - przed testem 5.5
4. 📋 **Wykonać test 5.2** - Długotrwałe zadania asynchroniczne
5. 📋 **Wykonać test 5.3** - Operacje strumieniowe
6. 📋 **Wykonać test 5.4** - Scenariusze awarii
7. 📋 **Wykonać test 5.5** - Testy przeciążeniowe (po wdrożeniu cache)

## Załączniki

- [summary.json](../wyniki/5.1-20250122-143045/summary.json) - Pełne wyniki k6
- [metrics.json](../wyniki/5.1-20250122-143045/metrics.json) - Metryki Prometheus
- [response_times.png](../wyniki/5.1-20250122-143045/response_times.png) - Wykres czasów odpowiedzi
- [throughput.png](../wyniki/5.1-20250122-143045/throughput.png) - Wykres przepustowości
- [error_rate.png](../wyniki/5.1-20250122-143045/error_rate.png) - Wykres błędów
- [resource_usage.png](../wyniki/5.1-20250122-143045/resource_usage.png) - Wykres zasobów

---

**Raport przygotował:** Grzegorz Banaszak  
**Data:** 2025-01-22  
**Wersja raportu:** 1.0
