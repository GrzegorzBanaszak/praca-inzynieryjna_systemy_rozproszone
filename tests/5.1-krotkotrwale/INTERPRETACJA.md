# Przykładowe wyniki i interpretacja - Test 5.1

## Przykładowy wynik testu

### Metryki k6

```
     ✓ GET /api/product - status 200
     ✓ GET /api/product - odpowiedź w JSON
     ✓ GET /api/product - zawiera produkty
     ✓ GET /api/product - czas < 1s
     ✓ GET /api/product/:id - status 200
     ✓ GET /api/product/:id - zawiera ID
     ✓ GET /api/product/:id - czas < 1s

     checks.........................: 100.00% ✓ 8400      ✗ 0
     data_received..................: 2.1 MB  42 kB/s
     data_sent......................: 354 kB  7.1 kB/s
     http_req_blocked...............: avg=12.45µs  min=1.2µs   med=5.1µs   max=2.15ms   p(90)=8.9µs   p(95)=12.4µs
     http_req_connecting............: avg=4.23µs   min=0s      med=0s      max=1.87ms   p(90)=0s      p(95)=0s
     http_req_duration..............: avg=145.67ms min=45.12ms med=132.45ms max=456.78ms p(90)=234.56ms p(95)=287.34ms
       { expected_response:true }...: avg=145.67ms min=45.12ms med=132.45ms max=456.78ms p(90)=234.56ms p(95)=287.34ms
     http_req_failed................: 0.00%   ✓ 0         ✗ 8400
     http_req_receiving.............: avg=89.34µs  min=23.4µs  med=78.2µs  max=345.6µs  p(90)=145.3µs p(95)=178.9µs
     http_req_sending...............: avg=23.56µs  min=12.1µs  med=19.8µs  max=112.3µs  p(90)=34.5µs  p(95)=45.6µs
     http_req_tls_handshaking.......: avg=0s       min=0s      med=0s      max=0s       p(90)=0s      p(95)=0s
     http_req_waiting...............: avg=145.56ms min=45.01ms med=132.34ms max=456.67ms p(90)=234.45ms p(95)=287.23ms
     http_reqs......................: 8400    168/s
     iteration_duration.............: avg=589.34ms min=234.56ms med=567.89ms max=1.23s   p(90)=789.45ms p(95)=891.23ms
     iterations.....................: 4200    84/s
     vus............................: 1       min=1       max=100
     vus_max........................: 100     min=100     max=100
```

### Metryki z Prometheus

```json
{
  "http_metrics": {
    "requests_per_second": {
      "productservice": 168.45,
      "apigateway": 168.45
    },
    "response_time_p95_seconds": {
      "productservice": 0.287,
      "apigateway": 0.295
    }
  },
  "resource_metrics": {
    "cpu_usage_percent": {
      "productservice": 45.3,
      "apigateway": 23.8,
      "mongo": 12.4
    },
    "memory_usage_mb": {
      "productservice": 156.7,
      "apigateway": 89.3,
      "mongo": 234.5
    }
  },
  "service_health": {
    "productservice": "UP",
    "apigateway": "UP",
    "mongo": "UP"
  }
}
```

## Interpretacja wyników

### 1. Przepustowość (Throughput)

**Wynik:** 168 żądań/sekundę

**Interpretacja:**
- ✅ **Dobry wynik** dla środowiska Minikube z pojedynczymi replikami
- System obsługuje średnio 168 żądań HTTP na sekundę
- Przy 100 równoczesnych użytkownikach każdy użytkownik wykonuje ~1.68 żądania/s
- **Potencjał skalowania:** Przy skalowaniu horyzontalnym (więcej replik) przepustowość może wzrosnąć proporcjonalnie

**Porównanie:**
- ✅ Przekroczono próg minimalny (50 req/s)
- 🎯 Dobry wynik dla małego klastra
- ⚠️ Dla produkcji zalecane > 500 req/s (wymaga skalowania)

### 2. Opóźnienie (Latency)

**Wyniki:**
- Średnia: 145.67ms
- Mediana: 132.45ms
- P95: 287.34ms ✅ (< 500ms)
- P99: 356.78ms ✅ (< 500ms)
- Max: 456.78ms

**Interpretacja:**
- ✅ **Bardzo dobry wynik** - 95% żądań obsłużonych poniżej 300ms
- Rozkład czasów jest stabilny (mediana bliska średniej)
- Brak wyraźnych anomalii (max niewiele wyższy niż P99)
- **Wąskie gardło:** Najprawdopodobniej MongoDB (pojedyncza instancja bez optymalizacji)

**Rozkład opóźnień:**
```
Min     P50     P90     P95     P99     Max
|-------|-------|-------|-------|-------|
45ms   132ms   235ms   287ms   357ms  457ms
  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  90% żądań w tym zakresie
```

### 3. Współczynnik błędów (Error Rate)

**Wynik:** 0.00% ❌

**Interpretacja:**
- ✅ **Doskonały wynik** - brak błędów podczas testu
- Wszystkie sprawdzenia (checks) zakończone sukcesem
- System stabilny przy tym poziomie obciążenia
- **Zalecenie:** Przetestować przy wyższym obciążeniu (test 5.5)

### 4. Wykorzystanie zasobów

#### CPU Usage

| Serwis | Użycie CPU | Interpretacja |
|--------|-----------|---------------|
| ProductService | 45.3% | Średnie obciążenie, potencjał do obsługi większego ruchu |
| ApiGateway | 23.8% | Niskie obciążenie, routing nie jest wąskim gardłem |
| MongoDB | 12.4% | Niskie obciążenie bazy danych |

**Wnioski:**
- ✅ Żaden serwis nie jest przeciążony (< 80% CPU)
- Potencjał do zwiększenia obciążenia o ~2x bez dodatkowych zasobów
- **Rekomendacja:** Brak potrzeby zwiększania limitów CPU

#### Memory Usage

| Serwis | Użycie RAM | Interpretacja |
|--------|-----------|----------------|
| ProductService | 156.7 MB | Stabilne zużycie, typowe dla .NET |
| ApiGateway | 89.3 MB | Optymalne zużycie dla gateway |
| MongoDB | 234.5 MB | Standardowe dla MongoDB (cache + working set) |

**Wnioski:**
- ✅ Zużycie pamięci w normie
- Brak wycieków pamięci (stabilne wartości)
- **Rekomendacja:** Brak potrzeby zwiększania limitów RAM

### 5. Analiza wąskich gardeł

Na podstawie metryk można zidentyfikować potencjalne wąskie gardła:

1. **MongoDB (12.4% CPU, 234.5 MB RAM)**
   - Obecnie NIE jest wąskim gardłem
   - Przy większym obciążeniu może stać się problemem
   - **Zalecenie:** Dodać indeksy na często używane pola

2. **ProductService (45.3% CPU)**
   - Największe obciążenie spośród serwisów aplikacyjnych
   - Bezpośrednio obsługuje zapytania o produkty
   - **Zalecenie:** Rozważyć cache (Redis) dla list produktów

3. **Sieć (avg=145ms latency)**
   - Komunikacja między serwisami dodaje opóźnienie
   - W środowisku lokalnym (Minikube) jest to normalne
   - **Zalecenie:** W produkcji użyć Service Mesh (Istio/Linkerd)

### 6. Rekomendacje optymalizacyjne

#### Krótkoterminowe (łatwe do wdrożenia):

1. **Cache dla ProductService**
   ```yaml
   # Dodać Redis do Kubernetes
   - Cachować listę produktów (TTL: 5 min)
   - Cachować pojedyncze produkty (TTL: 10 min)
   - Oczekiwane: redukcja latency o 50-70%
   ```

2. **Indeksy w MongoDB**
   ```javascript
   // Dodać indeksy
   db.Products.createIndex({ "name": 1 })
   db.Products.createIndex({ "price": 1, "stock": 1 })
   // Oczekiwane: redukcja query time o 30-40%
   ```

3. **Connection pooling**
   ```csharp
   // Zwiększyć rozmiar puli połączeń
   services.Configure<MongoDbSettings>(opts => {
       opts.MaxPoolSize = 100;
       opts.MinPoolSize = 10;
   });
   ```

#### Długoterminowe (wymagają zmian architektonicznych):

1. **Skalowanie horyzontalne**
   - Zwiększyć replicas dla ProductService do 3
   - Oczekiwana przepustowość: ~450-500 req/s

2. **Service Mesh**
   - Wdrożyć Istio dla lepszej komunikacji między serwisami
   - Circuit breakers, retry policies, timeout handling

3. **Read replicas dla MongoDB**
   - Skonfigurować MongoDB Replica Set
   - Odczyt z secondary nodes, zapis na primary

### 7. Porównanie z wymaganiami

| Metryka | Wymaganie | Wynik | Status |
|---------|-----------|-------|--------|
| P95 latency | < 500ms | 287.34ms | ✅ Spełnione |
| Error rate | < 5% | 0% | ✅ Spełnione |
| Throughput | > 50 req/s | 168 req/s | ✅ Spełnione |
| Dostępność | 100% | 100% | ✅ Spełnione |

**Podsumowanie:** ✅ Test zakończony sukcesem - wszystkie wymagania spełnione

## Wnioski końcowe

### Mocne strony systemu

1. **Stabilność** - brak błędów przy standardowym obciążeniu
2. **Niskie opóźnienia** - 95% żądań < 300ms
3. **Efektywne wykorzystanie zasobów** - potencjał do obsługi większego ruchu
4. **Dobra architektura** - separacja serwisów działa prawidłowo

### Obszary do poprawy

1. **Brak cachowania** - każde żądanie idzie do bazy
2. **Pojedyncze repliki** - brak redundancji
3. **Brak monitoringu biznesowego** - tylko metryki techniczne
4. **MongoDB nie zoptymalizowana** - brak indeksów

### Następne kroki

1. ✅ Test 5.1 zakończony - przechodzimy do testu 5.2 (zadania asynchroniczne)
2. 📋 Wdrożyć cache (Redis) przed testem 5.5 (przeciążeniowy)
3. 📋 Dodać indeksy do MongoDB
4. 📋 Przygotować konfigurację dla większej liczby replik

### Pytania do dalszej analizy

1. Jak system zachowa się przy 500-1000 równoczesnych użytkownikach? (Test 5.5)
2. Czy awaria MongoDB wpłynie na dostępność całego systemu? (Test 5.4)
3. Jak długo trwa przetwarzanie zadań asynchronicznych? (Test 5.2)
4. Czy system obsłuży ciągły strumień zdarzeń? (Test 5.3)

---

**Data analizy:** {DATA}  
**Środowisko:** Minikube 1.32, Kubernetes 1.28  
**Konfiguracja:** 1 replica per service, 4 CPU, 8GB RAM
