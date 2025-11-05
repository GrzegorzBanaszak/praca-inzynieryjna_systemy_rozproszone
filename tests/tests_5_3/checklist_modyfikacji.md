# Checklist modyfikacji serwisów - REST vs gRPC

## KROK 1: Przygotowanie struktury katalogów

Zanim zaczniesz modyfikować kod, upewnij się, że masz odpowiednią strukturę katalogów.

```bash
# W katalogu głównym twojego projektu (tam gdzie jest docker-compose.yml)
cd src

# Utwórz katalog dla wspólnych definicji Protocol Buffers
mkdir Protos

# Skopiuj pliki .proto, które przygotowałem:
# - user.proto
# - product.proto  
# - order.proto
# do katalogu src/Protos/
```

Twoja struktura powinna teraz wyglądać tak:

```
src/
├── Protos/                          # ← NOWY katalog
│   ├── user.proto                   # ← NOWY plik
│   ├── product.proto                # ← NOWY plik
│   └── order.proto                  # ← NOWY plik
├── ApiGatewayService/
├── UserService/
├── ProductService/
├── OrderService/
└── NotificationService/
```

---

## KROK 2: Modyfikacja UserService

### 2.1 UserService.csproj - dodanie pakietów

Otwórz plik `src/UserService/UserService.csproj` i znajdź sekcję `<ItemGroup>` z PackageReference. Dodaj na końcu tej sekcji trzy nowe pakiety:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <!-- Twoje istniejące pakiety... -->
    <PackageReference Include="AutoMapper.Extensions.Microsoft.DependencyInjection" Version="12.0.1" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.17" />
    <!-- ... itd ... -->

    <!-- ↓↓↓ DODAJ TE 3 PAKIETY ↓↓↓ -->
    <PackageReference Include="Grpc.AspNetCore" Version="2.63.0" />
    <PackageReference Include="Grpc.Tools" Version="2.63.0">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
    <PackageReference Include="Google.Protobuf" Version="3.26.1" />
  </ItemGroup>

  <!-- ↓↓↓ DODAJ NOWĄ SEKCJĘ ItemGroup dla .proto ↓↓↓ -->
  <ItemGroup>
    <Protobuf Include="../Protos/user.proto" GrpcServices="Server" />
  </ItemGroup>
</Project>
```

**Co robią te pakiety?**
- `Grpc.AspNetCore` - główny pakiet, który pozwala ASP.NET Core hostować serwisy gRPC
- `Grpc.Tools` - narzędzia kompilujące pliki .proto do klas C#
- `Google.Protobuf` - runtime do serializacji/deserializacji Protocol Buffers

**Co robi sekcja `<Protobuf>`?**
Mówi kompilatorowi, żeby wygenerował klasy C# z pliku `user.proto`. `GrpcServices="Server"` oznacza, że ten serwis będzie SERWEREM gRPC (obsługuje żądania, nie je wysyła).

### 2.2 Struktura katalogów UserService

Utwórz nowy katalog dla kodu gRPC:

```bash
cd src/UserService
mkdir GrpcServices
```

### 2.3 Dodanie implementacji gRPC

Skopiuj plik `UserService_GrpcServices_UserGrpcService.cs` (który przygotowałem) do:
```
src/UserService/GrpcServices/UserGrpcService.cs
```

### 2.4 Modyfikacja Program.cs

Otwórz `src/UserService/Program.cs` i dodaj konfigurację gRPC.

**Znajdź linię:** (około linii 20-30)
```csharp
builder.Services.AddControllers();
```

**Dodaj ZARAZ PO NIEJ:**
```csharp
builder.Services.AddControllers();
builder.Services.AddGrpc();  // ← DODAJ tę linię
```

**Następnie znajdź sekcję z `app.MapControllers()`:** (około linii 50-60)
```csharp
app.MapHealthChecks("/healthz");
app.MapMetrics();
app.MapControllers();
```

**Dodaj ZARAZ PO `app.MapControllers()`:**
```csharp
app.MapHealthChecks("/healthz");
app.MapMetrics();
app.MapControllers();

// ↓↓↓ DODAJ TE LINIE ↓↓↓
app.MapGrpcService<UserService.GrpcServices.UserGrpcService>();

// Opcjonalnie: włącz reflection dla narzędzi debugowania (tylko Development)
if (app.Environment.IsDevelopment())
{
    app.MapGrpcReflectionService();
}
```

**Co to robi?**
- `AddGrpc()` - włącza obsługę gRPC w pipeline ASP.NET Core
- `MapGrpcService<T>()` - rejestruje nasz serwis gRPC w routingu
- `MapGrpcReflectionService()` - opcjonalnie pozwala narzędziom (grpcurl, Postman) odkryć metody bez pliku .proto

### 2.5 Weryfikacja UserService

Zapisz wszystkie pliki i zbuduj projekt:

```bash
cd src/UserService
dotnet build
```

Jeśli wszystko poszło dobrze, zobaczysz komunikaty o wygenerowaniu klas z user.proto. Jeśli są błędy, upewnij się, że:
- Plik `../Protos/user.proto` istnieje i jest poprawny
- Namespace w user.proto (`GrpcServices.User`) pasuje do użycia w UserGrpcService.cs

---

## KROK 3: Modyfikacja ProductService

### 3.1 ProductService.csproj

Dokładnie te same zmiany co w UserService, ale z innym plikiem .proto:

```xml
<ItemGroup>
  <!-- Istniejące pakiety... -->
  
  <!-- Dodaj te 3 pakiety: -->
  <PackageReference Include="Grpc.AspNetCore" Version="2.63.0" />
  <PackageReference Include="Grpc.Tools" Version="2.63.0">
    <PrivateAssets>all</PrivateAssets>
    <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
  </PackageReference>
  <PackageReference Include="Google.Protobuf" Version="3.26.1" />
</ItemGroup>

<!-- Dodaj nową sekcję: -->
<ItemGroup>
  <Protobuf Include="../Protos/product.proto" GrpcServices="Server" />
</ItemGroup>
```

### 3.2 Struktura katalogów

```bash
cd src/ProductService
mkdir GrpcServices
```

### 3.3 Dodanie implementacji

Skopiuj plik `ProductService_GrpcServices_ProductGrpcService.cs` do:
```
src/ProductService/GrpcServices/ProductGrpcService.cs
```

### 3.4 Modyfikacja Program.cs

Otwórz `src/ProductService/Program.cs`.

**Znajdź:**
```csharp
builder.Services.AddControllers();
```

**Dodaj PO TEJ LINII:**
```csharp
builder.Services.AddGrpc();
```

**Znajdź:**
```csharp
app.MapControllers();
```

**Dodaj PO TEJ LINII:**
```csharp
app.MapGrpcService<ProductService.GrpcServices.ProductGrpcService>();

if (app.Environment.IsDevelopment())
{
    app.MapGrpcReflectionService();
}
```

### 3.5 Weryfikacja

```bash
cd src/ProductService
dotnet build
```

---

## KROK 4: Modyfikacja OrderService

### 4.1 OrderService.csproj

Te same 3 pakiety co poprzednio:

```xml
<ItemGroup>
  <!-- Istniejące pakiety... -->
  
  <PackageReference Include="Grpc.AspNetCore" Version="2.63.0" />
  <PackageReference Include="Grpc.Tools" Version="2.63.0">
    <PrivateAssets>all</PrivateAssets>
    <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
  </PackageReference>
  <PackageReference Include="Google.Protobuf" Version="3.26.1" />
</ItemGroup>

<ItemGroup>
  <Protobuf Include="../Protos/order.proto" GrpcServices="Server" />
</ItemGroup>
```

### 4.2 Struktura katalogów

```bash
cd src/OrderService
mkdir GrpcServices
```

### 4.3 Dodanie implementacji

Skopiuj plik `OrderService_GrpcServices_OrderGrpcService.cs` do:
```
src/OrderService/GrpcServices/OrderGrpcService.cs
```

### 4.4 Modyfikacja Program.cs

Otwórz `src/OrderService/Program.cs`.

**Znajdź:**
```csharp
builder.Services.AddControllers();
```

**Dodaj PO TEJ LINII:**
```csharp
builder.Services.AddGrpc();
```

**Znajdź:**
```csharp
app.MapControllers();
```

**Dodaj PO TEJ LINII:**
```csharp
app.MapGrpcService<OrderService.GrpcServices.OrderGrpcService>();

if (app.Environment.IsDevelopment())
{
    app.MapGrpcReflectionService();
}
```

### 4.5 Weryfikacja

```bash
cd src/OrderService
dotnet build
```

---

## KROK 5: Konfiguracja Docker (WAŻNE!)

Aby gRPC działał w kontenerach Docker, musisz upewnić się, że ASP.NET Core obsługuje zarówno HTTP/1.1 (dla REST) jak i HTTP/2 (dla gRPC).

### 5.1 Modyfikacja docker-compose.yml (lub Kubernetes manifests)

Dla każdego serwisu (userservice, productservice, orderservice) dodaj zmienną środowiskową:

```yaml
services:
  userservice:
    build:
      context: ./src/UserService
      dockerfile: Dockerfile
    ports:
      - "5185:80"
    environment:
      - ASPNETCORE_URLS=http://+:80
      - ASPNETCORE_HTTP_PROTOCOLS=Http1AndHttp2  # ← DODAJ tę linię
      # ... inne zmienne ...
```

**Dlaczego to ważne?**
Domyślnie ASP.NET Core w kontenerach może używać tylko HTTP/1.1. gRPC wymaga HTTP/2. Ustawienie `Http1AndHttp2` pozwala na obsługę obu protokołów jednocześnie na tym samym porcie. Dzięki temu:
- REST API działa na HTTP/1.1
- gRPC działa na HTTP/2
- Oba dostępne na porcie 80

Zrób to samo dla `productservice` i `orderservice`.

---

## KROK 6: Testowanie lokalne

Zanim uruchomisz w Docker, przetestuj lokalnie każdy serwis.

### 6.1 Uruchom serwis lokalnie

```bash
cd src/UserService
dotnet run
```

### 6.2 Testuj przez grpcurl

Zainstaluj grpcurl (jeśli jeszcze nie masz):

```bash
# macOS
brew install grpcurl

# Linux
# Pobierz z https://github.com/fullstorydev/grpcurl/releases

# Windows
scoop install grpcurl
```

Testuj rejestrację:

```bash
grpcurl -plaintext \
  -d '{"username": "testuser", "password": "testpass123"}' \
  localhost:5185 user.UserService/Register
```

Powinieneś zobaczyć:
```json
{
  "success": true,
  "message": "Rejestracja zakończona sukcesem"
}
```

Testuj logowanie:

```bash
grpcurl -plaintext \
  -d '{"username": "testuser", "password": "testpass123"}' \
  localhost:5185 user.UserService/Login
```

Skopiuj token z odpowiedzi i użyj go do testu profilu:

```bash
grpcurl -plaintext \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{}' \
  localhost:5185 user.UserService/GetProfile
```

### 6.3 Testuj ProductService

```bash
# Uruchom serwis
cd src/ProductService
dotnet run

# W innym terminalu:
grpcurl -plaintext localhost:5282 product.ProductService/GetAll
```

### 6.4 Testuj OrderService

```bash
# Uruchom serwis
cd src/OrderService
dotnet run

# W innym terminalu (z tokenem JWT):
grpcurl -plaintext \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"product_id": "some_product_id", "quantity": 2}' \
  localhost:5093 order.OrderService/Create
```

---

## KROK 7: Uruchomienie w Docker

Po weryfikacji lokalnej, zbuduj i uruchom wszystko w Docker:

```bash
# W katalogu głównym projektu
docker-compose build
docker-compose up
```

Sprawdź logi każdego kontenera, czy wszystko się uruchomiło bez błędów:

```bash
docker-compose logs userservice
docker-compose logs productservice
docker-compose logs orderservice
```

---

## KROK 8: Weryfikacja końcowa

### Checklist przed testami k6:

- [ ] UserService buduje się bez błędów
- [ ] ProductService buduje się bez błędów
- [ ] OrderService buduje się bez błędów
- [ ] Wszystkie pliki .proto są w `src/Protos/`
- [ ] Implementacje gRPC są w odpowiednich katalogach `GrpcServices/`
- [ ] Program.cs w każdym serwisie ma `AddGrpc()` i `MapGrpcService<T>()`
- [ ] Docker Compose ma `ASPNETCORE_HTTP_PROTOCOLS=Http1AndHttp2` dla każdego serwisu
- [ ] Lokalne testy grpcurl działają (Register, Login, GetAll products)
- [ ] REST API nadal działa (nie zepsułeś istniejącej funkcjonalności)
- [ ] Wszystkie kontenery uruchamiają się w Docker Compose bez błędów

### Test pełnego flow:

Przetestuj kompletny scenariusz (ten sam, który będzie w k6):

1. **Rejestracja** (gRPC):
   ```bash
   grpcurl -plaintext -d '{"username": "k6test", "password": "pass123"}' \
     localhost:5185 user.UserService/Register
   ```

2. **Logowanie** (gRPC):
   ```bash
   grpcurl -plaintext -d '{"username": "k6test", "password": "pass123"}' \
     localhost:5185 user.UserService/Login
   ```
   → Skopiuj token

3. **Lista produktów** (gRPC):
   ```bash
   grpcurl -plaintext localhost:5282 product.ProductService/GetAll
   ```
   → Skopiuj ID pierwszego produktu

4. **Utworzenie zamówienia** (gRPC):
   ```bash
   grpcurl -plaintext \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"product_id": "PRODUCT_ID", "quantity": 1}' \
     localhost:5093 order.OrderService/Create
   ```

Jeśli wszystkie 4 kroki przeszły pomyślnie, jesteś gotowy do testów k6!

---

## Następne kroki

Po weryfikacji wszystkich punktów z checklisty, możemy przejść do:

1. **Przygotowania skryptów k6** - testy obciążeniowe dla REST i gRPC
2. **Konfiguracji monitoringu** - Prometheus/Grafana do zbierania metryk
3. **Uruchomienia testów** - porównanie wydajności

Powiedz mi, kiedy będziesz gotowy, a przygotujemy szczegółowe skrypty testowe!

---

## Troubleshooting - częste problemy

### Problem: "Could not find a part of the path '../Protos/user.proto'"

**Rozwiązanie:** Upewnij się, że struktura katalogów jest prawidłowa. Plik .csproj zakłada, że Protos jest jeden poziom wyżej (`../Protos/`). Jeśli twoja struktura jest inna, dostosuj ścieżkę.

### Problem: "The type or namespace name 'GrpcServices' could not be found"

**Rozwiązanie:** Zbuduj projekt ponownie (`dotnet build`). Klasy z .proto są generowane podczas kompilacji. Jeśli nadal nie działa, sprawdź czy `<Protobuf Include="...">` jest poprawnie skonfigurowane w .csproj.

### Problem: gRPC nie odpowiada w Docker

**Rozwiązanie:** Sprawdź czy masz ustawione `ASPNETCORE_HTTP_PROTOCOLS=Http1AndHttp2` w docker-compose.yml. Bez tego ASP.NET Core może nie obsługiwać HTTP/2.

### Problem: "Unauthenticated" przy wywołaniu z tokenem JWT

**Rozwiązanie:** W gRPC token przekazujemy w metadanych (header), nie w ciele żądania. Użyj `-H "Authorization: Bearer TOKEN"` w grpcurl.

### Problem: Błąd konwersji DateTime → Timestamp

**Rozwiązanie:** `Timestamp.FromDateTime()` wymaga czasu w UTC. Użyj `DateTime.SpecifyKind(dateTime, DateTimeKind.Utc)` jeśli twój DateTime nie jest w UTC.
