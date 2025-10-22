# Podsumowanie - Test 5.1: Krótkotrwałe zapytania synchroniczne

## 📋 Przegląd

Test 5.1 to pierwszy z pięciu scenariuszy testowych opisanych w rozdziale 5 pracy inżynierskiej. Koncentruje się na pomiarze wydajności systemu przy obsłudze krótkotrwałych, synchronicznych zapytań HTTP.

## 🎯 Cele testu

1. **Zmierzenie przepustowości** - ile żądań HTTP/s może obsłużyć system
2. **Pomiar opóźnień** - czas odpowiedzi dla różnych percentyli (P50, P95, P99)
3. **Ocena stabilności** - współczynnik błędów przy intensywnym ruchu
4. **Identyfikacja wąskich gardeł** - które komponenty ograniczają wydajność

## 📦 Struktura plików

```
5.1-krotkotrwale/
├── test-synchroniczne.js        # Główny skrypt testu k6
├── test-variants.js              # Warianty testu (light, standard, heavy, etc.)
├── run-test.sh                   # Skrypt automatycznego uruchomienia
├── collect-prometheus-metrics.py # Zbieranie metryk z Prometheus
├── visualize-results.py          # Generowanie wykresów
├── Makefile                      # Uproszczone komendy
├── README.md                     # Instrukcje uruchomienia
├── INTERPRETACJA.md              # Przykłady i interpretacja wyników
└── PODSUMOWANIE.md              # Ten plik
```

## 🚀 Szybki start

### Automatyczne uruchomienie (zalecane)

```bash
cd testy/5.1-krotkotrwale
make full-test
```

To polecenie:
1. Sprawdzi wymagania systemowe
2. Uruchomi test k6
3. Zbierze metryki z Prometheus
4. Wygeneruje wykresy
5. Wyświetli podsumowanie

### Ręczne uruchomienie

```bash
# 1. Sprawdź wymagania
make check

# 2. Uruchom test
make run

# 3. Zbierz metryki (opcjonalnie)
make collect

# 4. Wygeneruj wykresy (opcjonalnie)
make visualize
```

## 📊 Metryki i wyniki

### Kluczowe metryki k6

| Metryka | Opis | Próg akceptacji |
|---------|------|-----------------|
| `http_reqs` | Całkowita liczba żądań | - |
| `http_req_duration` | Czas odpowiedzi | P95 < 500ms |
| `http_req_failed` | Współczynnik błędów | < 5% |
| `http_reqs` (rate) | Przepustowość | > 50 req/s |
| `iterations` | Ukończone iteracje VU | - |

### Kluczowe metryki Prometheus

| Metryka | Zapytanie PromQL | Znaczenie |
|---------|------------------|-----------|
| Żądania/s | `rate(http_requests_received_total[1m])` | Przepustowość serwisu |
| CPU % | `rate(process_cpu_seconds_total[1m]) * 100` | Obciążenie procesora |
| RAM MB | `process_working_set_bytes / 1024 / 1024` | Zużycie pamięci |
| Latency P95 | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[1m]))` | Czas odpowiedzi |

## 🔍 Co testujemy

### Ścieżki testowe

1. **GET /api/product**
   - Pobranie listy wszystkich produktów
   - Test wydajności MongoDB i serializacji JSON
   - Największe obciążenie - zwraca wszystkie rekordy

2. **GET /api/product/:id**
   - Pobranie szczegółów konkretnego produktu
   - Test zapytań z parametrem
   - Lżejsze zapytanie - pojedynczy rekord

### Przepływ danych

```
VU (k6) → ApiGateway → ProductService → MongoDB
           ↓              ↓                ↓
      Prometheus ← [metryki] ← Prometheus
```

## 📈 Warianty testu

System obsługuje różne warianty testu dla różnych scenariuszy:

### 1. Light (lekki)
- 50 VU przez 20 sekund
- Dla środowisk developerskich
- ```bash
  k6 run -e VARIANT=light test-synchroniczne.js
  ```

### 2. Standard (domyślny)
- 100 VU przez 30 sekund
- Dla środowisk testowych
- ```bash
  k6 run test-synchroniczne.js
  ```

### 3. Heavy (ciężki)
- 200 VU przez 60 sekund
- Dla testów wydajnościowych
- ```bash
  k6 run -e VARIANT=heavy test-synchroniczne.js
  ```

### 4. Spike (skok)
- Nagły wzrost do 500 VU
- Test reakcji na nagły wzrost ruchu
- ```bash
  k6 run -e VARIANT=spike test-synchroniczne.js
  ```

### 5. Stress (stresowy)
- Stopniowe zwiększanie do 300 VU
- Wyszukiwanie punktu załamania
- ```bash
  k6 run -e VARIANT=stress test-synchroniczne.js
  ```

### 6. Soak (długotrwały)
- 100 VU przez 30 minut
- Test wycieków pamięci
- ```bash
  k6 run -e VARIANT=soak test-synchroniczne.js
  ```

## 📋 Checklist przed testem

- [ ] Klaster Kubernetes działa (`kubectl cluster-info`)
- [ ] Aplikacja wdrożona w namespace `distributed-system`
- [ ] Wszystkie pody w stanie `Running` (`kubectl get pods -n distributed-system`)
- [ ] API Gateway dostępne (`curl $API_GATEWAY/api/product/healthz`)
- [ ] Prometheus działa (`curl http://$(minikube ip):30090/-/healthy`)
- [ ] Grafana działa (`http://$(minikube ip):30300`)
- [ ] W bazie są produkty (lub użyj `make create-products`)
- [ ] k6 zainstalowane (`k6 version`)

## 🎓 Analiza wyników

### Krok 1: Sprawdź podstawowe metryki

```bash
# Odczytaj podsumowanie z pliku
cat ../wyniki/5.1-*/summary.json | jq '.metrics.http_req_duration.values'
```

Sprawdź:
- ✅ P95 < 500ms?
- ✅ Error rate < 5%?
- ✅ Throughput > 50 req/s?

### Krok 2: Przeanalizuj wykresy

Otwórz wygenerowane wykresy:
- `response_times.png` - rozkład czasów odpowiedzi
- `throughput.png` - przepustowość systemu
- `error_rate.png` - współczynnik błędów
- `resource_usage.png` - wykorzystanie zasobów

### Krok 3: Sprawdź metryki Prometheus

```bash
# Żądania/sekundę na serwis
curl "http://$(minikube ip):30090/api/v1/query?query=rate(http_requests_received_total[1m])" | jq

# Wykorzystanie CPU
curl "http://$(minikube ip):30090/api/v1/query?query=rate(process_cpu_seconds_total[1m])*100" | jq
```

### Krok 4: Identyfikuj wąskie gardła

Sprawdź który komponent ma:
- Najwyższe CPU usage (> 80%)
- Najwyższe opóźnienia (> 200ms)
- Największy ruch (req/s)

### Krok 5: Porównaj z wymaganiami

| Wymaganie | Oczekiwana wartość | Twój wynik | Status |
|-----------|-------------------|------------|--------|
| P95 latency | < 500ms | ? | ⬜ |
| Error rate | < 5% | ? | ⬜ |
| Throughput | > 50 req/s | ? | ⬜ |
| Availability | 100% | ? | ⬜ |

## 🐛 Rozwiązywanie problemów

### Problem 1: Test nie może się połączyć z API

**Objawy:**
```
ERRO[0001] GoError: Get "http://localhost:80/api/product": dial tcp connect: connection refused
```

**Rozwiązanie:**
```bash
# Sprawdź czy pody działają
kubectl get pods -n distributed-system

# Sprawdź poprawny adres API Gateway
export API_GATEWAY="http://$(minikube ip):$(kubectl get svc apigateway -n distributed-system -o jsonpath='{.spec.ports[0].nodePort}')"
echo $API_GATEWAY

# Przetestuj połączenie
curl ${API_GATEWAY}/api/product/healthz
```

### Problem 2: Wysokie czasy odpowiedzi (P95 > 1s)

**Możliwe przyczyny:**
1. MongoDB nie jest zoptymalizowana (brak indeksów)
2. Za mało zasobów (CPU/RAM)
3. Sieć jest przeciążona

**Diagnostyka:**
```bash
# Sprawdź wykorzystanie zasobów
kubectl top pods -n distributed-system

# Sprawdź logi ProductService
kubectl logs -n distributed-system -l app=productservice --tail=100

# Sprawdź MongoDB
kubectl exec -it -n distributed-system deployment/mongo -- mongosh --eval "db.serverStatus().connections"
```

### Problem 3: Błędy 5xx w testach

**Objawy:**
```
http_req_failed................: 15.34% ✓ 645 ✗ 3555
```

**Rozwiązanie:**
```bash
# Sprawdź logi ApiGateway
kubectl logs -n distributed-system -l app=apigateway -f

# Sprawdź health wszystkich serwisów
for svc in apigateway productservice userservice orderservice notificationservice; do
  echo "=== $svc ==="
  kubectl get pods -n distributed-system -l app=$svc
done

# Restart problematycznego serwisu
kubectl rollout restart deployment/productservice -n distributed-system
```

### Problem 4: Prometheus nie zwraca metryk

**Rozwiązanie:**
```bash
# Sprawdź czy Prometheus działa
kubectl get pods -n distributed-system -l app=prometheus

# Sprawdź targets w Prometheus UI
# http://$(minikube ip):30090/targets

# Sprawdź czy serwisy eksponują metryki
curl ${API_GATEWAY}/metrics
```

## 📚 Dokumentacja dodatkowa

### Przydatne linki

- **k6 Documentation**: https://k6.io/docs/
- **Prometheus Queries**: https://prometheus.io/docs/prometheus/latest/querying/basics/
- **Kubernetes Debugging**: https://kubernetes.io/docs/tasks/debug/

### Zapytania PromQL do dalszej analizy

```promql
# Top 5 najwolniejszych endpointów
topk(5, histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])))

# Wykorzystanie pamięci w czasie
process_working_set_bytes / 1024 / 1024

# Liczba aktywnych połączeń
sum(rate(http_requests_received_total[1m])) by (job)

# Współczynnik błędów 5xx
rate(http_requests_failed_total{status=~"5.."}[5m]) / rate(http_requests_received_total[5m])
```

## ✅ Kryteria sukcesu

Test uznajemy za zakończony sukcesem, gdy:

1. ✅ **Wszystkie sprawdzenia k6 przeszły** (checks: 100%)
2. ✅ **P95 latency < 500ms**
3. ✅ **Error rate < 5%**
4. ✅ **Throughput > 50 req/s**
5. ✅ **Brak restartów podów** podczas testu
6. ✅ **Wykorzystanie CPU < 80%** dla wszystkich serwisów
7. ✅ **Brak wycieków pamięci** (stabilne zużycie RAM)

## 📝 Co dalej?

Po zakończeniu testu 5.1:

1. ✅ **Przeanalizuj wyniki** zgodnie z `INTERPRETACJA.md`
2. ✅ **Zapisz wnioski** do dokumentacji pracy
3. ✅ **Zidentyfikuj optymalizacje** (cache, indeksy, scaling)
4. 📋 **Przejdź do testu 5.2** - Długotrwałe zadania asynchroniczne
5. 📋 **Porównaj wyniki** z innymi testami

### Następne testy

- **Test 5.2**: Długotrwałe zadania asynchroniczne (Kafka, OrderService)
- **Test 5.3**: Operacje strumieniowe (event streaming)
- **Test 5.4**: Scenariusze awarii (chaos engineering)
- **Test 5.5**: Testy przeciążeniowe (stress testing)

## 🙋 FAQ

**Q: Ile czasu trwa test?**  
A: Standardowy wariant: ~50 sekund (5s rozgrzewka + 10s ramp-up + 30s test + 5s cool-down)

**Q: Czy mogę uruchomić test na produkcji?**  
A: NIE! Ten test generuje znaczne obciążenie. Tylko środowiska testowe.

**Q: Co jeśli nie mam Prometheus?**  
A: Test k6 zadziała bez Prometheus, ale nie będziesz mógł zebrać metryk zasobów.

**Q: Jak często powinien być uruchamiany?**  
A: Zalecane: raz na sprint lub przy większych zmianach w kodzie.

**Q: Co zrobić jeśli test nie przechodzi?**  
A: Zobacz sekcję "Rozwiązywanie problemów" i sprawdź logi serwisów.

## 📞 Wsparcie

W przypadku problemów:
1. Sprawdź sekcję "Rozwiązywanie problemów"
2. Przejrzyj logi: `kubectl logs -n distributed-system --all-containers`
3. Sprawdź dokumentację k6: https://k6.io/docs/

---

**Autor:** Grzegorz Banaszak  
**Data:** 2025  
**Wersja:** 1.0  
**Praca inżynierska:** System rozproszony oparty na architekturze mikroserwisów
