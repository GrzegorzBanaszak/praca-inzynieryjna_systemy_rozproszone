# Quick Start - Test 5.1

## ⚡ Najszybsza droga

```bash
cd testy/5.1-krotkotrwale
make full-test
```

To wszystko! 🎉

## 📋 Co się stanie?

1. ✅ Sprawdzenie wymagań (k6, kubectl, jq)
2. ✅ Weryfikacja klastra Kubernetes
3. ✅ Pobranie adresu API Gateway
4. ✅ Utworzenie produktów testowych (jeśli brak)
5. ✅ Uruchomienie testu k6 (100 VU, 30s)
6. ✅ Zebranie metryk z Prometheus
7. ✅ Wygenerowanie wykresów
8. ✅ Wyświetlenie raportu

## ⏱️ Ile to trwa?

- **Test k6**: ~50 sekund
- **Zbieranie metryk**: ~10 sekund
- **Generowanie wykresów**: ~5 sekund
- **RAZEM**: ~1-2 minuty

## 📊 Co dostanę?

Po zakończeniu znajdziesz w katalogu `../wyniki/5.1-YYYYMMDD-HHMMSS/`:

```
wyniki/5.1-20250122-143045/
├── summary.json              # Podsumowanie metryk k6
├── results.json              # Pełne dane k6
├── output.log                # Log testu
├── metrics.json              # Metryki z Prometheus
├── response_times.png        # Wykres czasów odpowiedzi
├── throughput.png            # Wykres przepustowości
├── error_rate.png            # Wykres błędów
└── resource_usage.png        # Wykres zasobów
```

## 🎯 Progi sukcesu

Test jest OK jeśli:
- ✅ P95 < 500ms
- ✅ Błędy < 5%
- ✅ Przepustowość > 50 req/s

## 🔧 Co jeśli coś nie działa?

### 1. k6 nie jest zainstalowane

```bash
# Ubuntu/Debian
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# macOS
brew install k6
```

### 2. Klaster nie działa

```bash
minikube start
kubectl get nodes
```

### 3. Aplikacja nie wdrożona

```bash
cd k8s
terraform init
terraform apply
```

### 4. API Gateway niedostępne

```bash
# Sprawdź pody
kubectl get pods -n distributed-system

# Sprawdź serwis
kubectl get svc apigateway -n distributed-system

# Test połączenia
MINIKUBE_IP=$(minikube ip)
NODE_PORT=$(kubectl get svc apigateway -n distributed-system -o jsonpath='{.spec.ports[0].nodePort}')
curl http://${MINIKUBE_IP}:${NODE_PORT}/api/product/healthz
```

## 🎓 Inne opcje uruchomienia

### Tylko test k6 (bez metryk Prometheus)
```bash
make run
```

### Test + metryki (bez wykresów)
```bash
make run
make collect
```

### Tylko wykresy (jeśli już masz wyniki)
```bash
make visualize RESULTS_DIR=../wyniki/5.1-20250122-143045
```

### Test z innym API Gateway
```bash
make run API_GATEWAY=http://192.168.49.2:30080
```

### Lekki wariant testu (50 VU)
```bash
k6 run -e VARIANT=light test-synchroniczne.js
```

### Ciężki wariant testu (200 VU)
```bash
k6 run -e VARIANT=heavy test-synchroniczne.js
```

## 📖 Więcej informacji

- **Pełna dokumentacja**: `README.md`
- **Interpretacja wyników**: `INTERPRETACJA.md`
- **Podsumowanie**: `PODSUMOWANIE.md`

## 💡 Wskazówki

1. **Przed testem**: Upewnij się że wszystkie pody są w stanie `Running`
   ```bash
   kubectl get pods -n distributed-system
   ```

2. **Podczas testu**: Możesz obserwować metryki w Grafanie
   ```bash
   echo "Grafana: http://$(minikube ip):30300"
   # Login: admin / admin123
   ```

3. **Po teście**: Przeanalizuj wykresy i porównaj z wymaganiami

## 🚨 Troubleshooting w 30 sekund

```bash
# Problem: Nic nie działa
kubectl get pods -n distributed-system          # Sprawdź pody
kubectl logs -n distributed-system -l app=apigateway  # Sprawdź logi

# Problem: Wysokie opóźnienia
kubectl top pods -n distributed-system          # Sprawdź zasoby

# Problem: Błędy 5xx
kubectl describe pod -n distributed-system -l app=productservice  # Szczegóły poda

# Problem: Prometheus nie działa
kubectl get pods -n distributed-system -l app=prometheus  # Status Prometheusa
```

## ✅ Gotowe!

Po uruchomieniu `make full-test` otrzymasz:
1. Raport tekstowy w terminalu
2. Pliki JSON z metrykami
3. Wykresy PNG
4. Logi testu

Powodzenia! 🚀

---

**Pro tip**: Uruchom `make help` aby zobaczyć wszystkie dostępne komendy.
