# Test 5.1: Krótkotrwałe zapytania synchroniczne

## Cel testu

Zmierzenie przepustowości systemu (liczby żądań HTTP obsłużonych w jednostce czasu) oraz opóźnienia (czasu odpowiedzi na pojedyncze żądanie) w warunkach intensywnego, lecz krótkotrwałego ruchu.

## Scenariusz testowy

- **100 wirtualnych użytkowników** wysyłających równoczesne zapytania
- **Czas trwania:** 30 sekund (test właściwy) + 20 sekund (ramp-up/down)
- **Typy zapytań:**
  - `GET /api/product` - pobranie listy wszystkich produktów
  - `GET /api/product/:id` - pobranie szczegółów konkretnego produktu

## Wymagania

### Oprogramowanie

1. **k6** - narzędzie do testów obciążeniowych
   ```bash
   # Ubuntu/Debian
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
     --keyserver hkp://keyserver.ubuntu.com:80 \
     --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
     sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   
   # macOS
   brew install k6
   
   # Windows
   choco install k6
   ```

2. **Python 3.x** (opcjonalnie, do zbierania metryk z Prometheus)
   ```bash
   pip install requests
   ```

3. **jq** (do parsowania JSON)
   ```bash
   sudo apt-get install jq  # Ubuntu/Debian
   brew install jq          # macOS
   ```

### Środowisko

1. **Klaster Kubernetes** (Minikube) musi być uruchomiony
   ```bash
   minikube start
   ```

2. **Aplikacja wdrożona** w namespace `distributed-system`
   ```bash
   cd k8s
   terraform init
   terraform apply
   ```

3. **Minikube tunnel** uruchomiony (jeśli używasz Ingress)
   ```bash
   minikube tunnel
   ```

4. **Prometheus i Grafana** wdrożone (do zbierania metryk)
   ```bash
   kubectl get pods -n distributed-system | grep -E "prometheus|grafana"
   ```

## Uruchomienie testu

### Metoda 1: Automatyczne uruchomienie (zalecana)

```bash
cd testy/5.1-krotkotrwale
chmod +x run-test.sh
./run-test.sh
```

Skrypt automatycznie:
- Sprawdzi wymagania systemowe
- Zweryfikuje działanie klastra
- Pobierze adres API Gateway
- Przygotuje dane testowe (utworzy produkty jeśli nie istnieją)
- Uruchomi test k6
- Wygeneruje raport z wynikami

### Metoda 2: Ręczne uruchomienie

1. **Pobranie adresu API Gateway:**
   ```bash
   # Jeśli używasz Ingress
   export API_GATEWAY="http://$(minikube ip)"
   
   # Jeśli używasz NodePort
   MINIKUBE_IP=$(minikube ip)
   NODE_PORT=$(kubectl get svc apigateway -n distributed-system -o jsonpath='{.spec.ports[0].nodePort}')
   export API_GATEWAY="http://${MINIKUBE_IP}:${NODE_PORT}"
   ```

2. **Sprawdzenie dostępności:**
   ```bash
   curl ${API_GATEWAY}/api/product/healthz
   ```

3. **Przygotowanie danych testowych:**
   ```bash
   # Utworzenie przykładowych produktów
   for i in {1..10}; do
     curl -X POST "${API_GATEWAY}/api/product" \
       -H "Content-Type: application/json" \
       -d "{\"name\":\"Produkt ${i}\",\"price\":$((i*10)),\"stock\":100}"
   done
   ```

4. **Uruchomienie testu k6:**
   ```bash
   k6 run --out json=results.json test-synchroniczne.js
   ```

## Zbieranie metryk z Prometheus

Podczas trwania testu możesz zbierać metryki z Prometheus:

### Przed testem

```bash
# Sprawdzenie dostępności Prometheus
PROMETHEUS_URL="http://$(minikube ip):30090"
curl ${PROMETHEUS_URL}/api/v1/query?query=up

# Uruchomienie zbierania metryk w tle
python3 collect-prometheus-metrics.py \
  --prometheus-url ${PROMETHEUS_URL} \
  --duration 2 \
  --output metrics-before.json
```

### Podczas testu

W osobnym terminalu:

```bash
# Ciągłe zbieranie metryk
python3 collect-prometheus-metrics.py \
  --prometheus-url ${PROMETHEUS_URL} \
  --continuous \
  --output metrics-during.json
```

### Po teście

```bash
python3 collect-prometheus-metrics.py \
  --prometheus-url ${PROMETHEUS_URL} \
  --duration 2 \
  --output metrics-after.json
```

## Analiza wyników

### Wyniki z k6

Po zakończeniu testu otrzymasz:

1. **Plik JSON** (`results.json`) - surowe dane
2. **Plik podsumowania** (`summary.json`) - agregowane metryki
3. **Log tekstowy** (`output.log`) - pełny output testu

Kluczowe metryki do analizy:

- `http_reqs` - całkowita liczba żądań
- `http_req_duration` - czas odpowiedzi (avg, med, p95, p99, max)
- `http_req_failed` - współczynnik błędów
- `iterations` - liczba ukończonych iteracji
- `vus` - liczba aktywnych wirtualnych użytkowników

### Przykładowa analiza

```bash
# Podsumowanie w formacie czytelnym dla człowieka
cat summary.json | jq -r '
  "=== WYNIKI TESTU 5.1 ===\n",
  "Żądania:",
  "  Całkowite: \(.metrics.http_reqs.values.count)",
  "  Na sekundę: \(.metrics.http_reqs.values.rate | tonumber | round) req/s\n",
  "Czasy odpowiedzi:",
  "  Średnia: \(.metrics.http_req_duration.values.avg | tonumber | round) ms",
  "  Mediana: \(.metrics.http_req_duration.values.med | tonumber | round) ms",
  "  P95: \(.metrics.http_req_duration.values["p(95)"] | tonumber | round) ms",
  "  P99: \(.metrics.http_req_duration.values["p(99)"] | tonumber | round) ms",
  "  Max: \(.metrics.http_req_duration.values.max | tonumber | round) ms\n",
  "Błędy:",
  "  Współczynnik: \(.metrics.http_req_failed.values.rate * 100 | tonumber | round)%"
'
```

### Wykresy w Grafanie

1. Otwórz Grafanę:
   ```bash
   # Pobierz adres Grafany
   echo "http://$(minikube ip):30300"
   
   # Login: admin / admin123 (domyślne)
   ```

2. Otwórz dashboard "Microservices Overview"

3. Ustaw zakres czasu na okres testu

4. Analizuj wykresy:
   - HTTP Request Rate
   - HTTP Request Duration  
   - Services Health
   - Memory Usage
   - CPU Usage

## Progi akceptacji

Test uznajemy za zakończony sukcesem jeśli:

- ✅ **P95 < 500ms** - 95% żądań obsłużonych poniżej 500ms
- ✅ **Współczynnik błędów < 5%** - mniej niż 5% żądań zakończonych błędem
- ✅ **Przepustowość > 50 req/s** - system obsługuje co najmniej 50 żądań na sekundę
- ✅ **Wszystkie serwisy UP** - brak awarii serwisów podczas testu

## Rozwiązywanie problemów

### Problem: k6 nie może połączyć się z API Gateway

```bash
# Sprawdź status podów
kubectl get pods -n distributed-system

# Sprawdź logi ApiGateway
kubectl logs -n distributed-system -l app=apigateway

# Sprawdź ingress/service
kubectl get ingress -n distributed-system
kubectl get svc apigateway -n distributed-system
```

### Problem: Wysokie czasy odpowiedzi

```bash
# Sprawdź wykorzystanie zasobów
kubectl top pods -n distributed-system

# Sprawdź logi serwisów
kubectl logs -n distributed-system -l app=productservice --tail=100

# Sprawdź stan bazy danych MongoDB
kubectl exec -it -n distributed-system deployment/mongo -- mongosh --eval "db.adminCommand('ping')"
```

### Problem: Błędy 5xx

```bash
# Sprawdź health check
curl ${API_GATEWAY}/api/product/healthz

# Sprawdź logi wszystkich serwisów
kubectl logs -n distributed-system --all-containers=true --tail=50

# Restart problematycznego serwisu
kubectl rollout restart deployment/productservice -n distributed-system
```

## Pliki

- `test-synchroniczne.js` - główny skrypt testu k6
- `run-test.sh` - skrypt automatyzujący uruchomienie testu
- `collect-prometheus-metrics.py` - skrypt do zbierania metryk z Prometheus
- `README.md` - ten plik

## Dalsze kroki

Po zakończeniu testu 5.1 przejdź do:
- **Test 5.2:** Długotrwałe zadania asynchroniczne
- **Test 5.3:** Operacje strumieniowe
- **Test 5.4:** Scenariusze awarii
- **Test 5.5:** Testy przeciążeniowe

## Kontakt i wsparcie

W przypadku problemów sprawdź:
- Dokumentację k6: https://k6.io/docs/
- Dokumentację Kubernetes: https://kubernetes.io/docs/
- Logi aplikacji: `kubectl logs -n distributed-system`
