# Przewodnik: Dodanie gRPC do systemu mikrousług
## Porównanie REST vs gRPC - Implementacja krok po kroku

### Spis treści
1. [Przygotowanie środowiska](#przygotowanie)
2. [Definicje Protocol Buffers](#protobuf)
3. [Modyfikacja UserService](#userservice)
4. [Modyfikacja ProductService](#productservice)
5. [Modyfikacja OrderService](#orderservice)
6. [Konfiguracja ApiGateway](#apigateway)
7. [Weryfikacja i testy](#weryfikacja)

---

## Wprowadzenie teoretyczne

Zanim zaczniesz wprowadzać zmiany, pozwól, że wyjaśnię fundamentalne różnice między REST a gRPC, abyś rozumiał "dlaczego" za każdą zmianą.

### REST (HTTP/JSON)
REST API wykorzystuje HTTP/1.1 z tekstowym formatem JSON. Wyobraź sobie, że wysyłasz list pocztą - piszesz wiadomość po polsku (JSON), pakujesz w kopertę (HTTP), i wysyłasz. Każda przesyłka to osobne połączenie. To jest czytelne dla człowieka, łatwe do debugowania, ale wymaga więcej miejsca i czasu.

### gRPC (HTTP/2 + Protocol Buffers)
gRPC wykorzystuje HTTP/2 z binarnym formatem Protocol Buffers. To jak wysłanie telegramu w kodzie Morse'a - bardzo zwięzły, szybki, ale trudniejszy do odczytania bez odpowiedniego narzędzia. HTTP/2 pozwala na wysłanie wielu wiadomości jednocześnie przez to samo "połączenie telefoniczne" (multipleksowanie), co dramatycznie zmniejsza opóźnienia.

**Kluczowe zalety gRPC:**
- Kompaktowy format binarny (mniejsze payload)
- HTTP/2 multiplexing (wiele requestów na jednym połączeniu)
- Silne typowanie (błędy wykrywane na etapie kompilacji)
- Dwukierunkowy streaming (jeśli potrzebujesz w przyszłości)

**Kiedy REST jest lepszy:**
- Debugging w przeglądarce (JSON jest czytelny)
- Publiczne API dla zewnętrznych klientów
- Prostota implementacji dla prostych CRUD

---

## KROK 1: Przygotowanie środowiska {#przygotowanie}

### 1.1 Instalacja narzędzi

Najpierw upewnijmy się, że masz zainstalowane niezbędne narzędzia. Protocol Buffers wymaga kompilatora, który przekształci definicje .proto na kod C#.

```bash
# Sprawdź, czy masz zainstalowany kompilator protobuf
dotnet tool list -g

# Jeśli nie masz, zainstaluj:
dotnet tool install -g dotnet-grpc
```

**Dlaczego to ważne?** Kompilator protobuf działa jak tłumacz - bierze twoje definicje w pliku .proto i generuje kod C#, który rozumie twoja aplikacja. To automatyzuje proces tworzenia klas do serializacji/deserializacji.

### 1.2 Struktura katalogów

Utworzymy wspólny katalog dla definicji Protocol Buffers. Dzięki temu wszystkie serwisy będą używały tych samych definicji, co zapewni spójność komunikacji.

```
src/
├── Protos/              # NOWY - wspólne definicje
│   ├── user.proto
│   ├── product.proto
│   └── order.proto
├── ApiGatewayService/
├── UserService/
├── ProductService/
├── OrderService/
└── NotificationService/
```

Wyobraź sobie to jak wspólny słownik języka, którego używają wszystkie mikrousługi. Dzięki temu "UserService" i "OrderService" mówią dokładnie tym samym językiem.

---

## KROK 2: Definicje Protocol Buffers {#protobuf}

### 2.1 Czym są pliki .proto?

Pliki .proto to język definicji interfejsów (IDL - Interface Definition Language). Działają jak kontrakt między serwisami - definiują dokładnie, jakie dane będą wymieniane i w jakiej strukturze.

**Kluczowe elementy:**
- **message** - odpowiednik klasy/DTO w C#
- **service** - odpowiednik interfejsu serwisu
- **rpc** - odpowiednik metody

### 2.2 Plik user.proto

Ten plik definiuje wszystkie operacje związane z użytkownikami.

```protobuf
syntax = "proto3";

option csharp_namespace = "GrpcServices.User";

package user;

// Serwis obsługujący użytkowników
// Odpowiednik IAuthService i IUserService połączonych razem
service UserService {
  // Rejestracja nowego użytkownika
  // Zwraca informację o sukcesie lub błędzie
  rpc Register (RegisterRequest) returns (RegisterResponse);
  
  // Logowanie użytkownika
  // Zwraca token JWT, który będzie używany w kolejnych zapytaniach
  rpc Login (LoginRequest) returns (LoginResponse);
  
  // Pobranie profilu zalogowanego użytkownika
  // Wymaga przekazania tokenu w metadanych
  rpc GetProfile (GetProfileRequest) returns (UserProfile);
}

// Struktura żądania rejestracji
// Pola są numerowane - to ważne dla kompatybilności wstecznej
message RegisterRequest {
  string username = 1;  // Pole numer 1
  string password = 2;  // Pole numer 2
}

// Odpowiedź na rejestrację
message RegisterResponse {
  bool success = 1;
  string message = 2;  // Opcjonalna wiadomość (np. błąd)
}

// Struktura żądania logowania
message LoginRequest {
  string username = 1;
  string password = 2;
}

// Odpowiedź na logowanie
message LoginResponse {
  bool success = 1;
  string token = 2;      // Token JWT
  string message = 3;    // Opcjonalna wiadomość (np. błąd)
}

// Żądanie profilu (może być puste, bo userId bierzemy z tokenu)
message GetProfileRequest {
  // Puste - userId wyciągniemy z JWT w metadanych
}

// Profil użytkownika
message UserProfile {
  string id = 1;         // GUID jako string
  string username = 2;
}
```

**Wyjaśnienie numeracji pól:**
Każde pole ma unikalny numer (np. `string username = 1`). Ten numer to identyfikator pola w formacie binarnym. Dlaczego to ważne? Jeśli w przyszłości dodasz nowe pole `email = 3`, stare aplikacje, które nie znają tego pola, nadal będą działać. To kluczowa cecha Protocol Buffers - kompatybilność wsteczna.

### 2.3 Plik product.proto

```protobuf
syntax = "proto3";

option csharp_namespace = "GrpcServices.Product";

package product;

// Serwis obsługujący produkty
service ProductService {
  // Pobranie listy wszystkich produktów
  // W REST: GET /api/product
  rpc GetAll (GetAllProductsRequest) returns (ProductList);
  
  // Pobranie pojedynczego produktu po ID
  // W REST: GET /api/product/{id}
  rpc GetById (GetProductByIdRequest) returns (ProductResponse);
  
  // Utworzenie nowego produktu
  // W REST: POST /api/product
  rpc Create (CreateProductRequest) returns (ProductResponse);
}

// Puste żądanie - potrzebujemy go dla spójności API
message GetAllProductsRequest {
  // Możesz dodać tutaj paginację w przyszłości:
  // int32 page = 1;
  // int32 page_size = 2;
}

// Lista produktów
message ProductList {
  repeated ProductDto products = 1;  // "repeated" = lista/array
}

// Pojedynczy produkt jako odpowiedź
message ProductResponse {
  ProductDto product = 1;
  bool success = 2;
  string message = 3;
}

// Żądanie produktu po ID
message GetProductByIdRequest {
  string id = 1;  // MongoDB ObjectId jako string
}

// Żądanie utworzenia produktu
message CreateProductRequest {
  string name = 1;
  double price = 2;    // decimal w C# → double w proto
  int32 stock = 3;
}

// DTO produktu - główna struktura danych
message ProductDto {
  string id = 1;
  string name = 2;
  double price = 3;
  int32 stock = 4;
}
```

**Typy danych w Protocol Buffers:**
- `string` - tekst UTF-8
- `int32` - liczba całkowita 32-bitowa
- `double` - liczba zmiennoprzecinkowa (używamy dla decimal z C#)
- `bool` - prawda/fałsz
- `repeated` - lista/tablica

### 2.4 Plik order.proto

```protobuf
syntax = "proto3";

option csharp_namespace = "GrpcServices.Order";

package order;

import "google/protobuf/timestamp.proto";  // Import typu timestamp

// Serwis obsługujący zamówienia
service OrderService {
  // Utworzenie zamówienia (wersja asynchroniczna z Kafka)
  // W REST: POST /api/order
  rpc Create (CreateOrderRequest) returns (OrderResponse);
  
  // Utworzenie zamówienia (wersja synchroniczna bez Kafka)
  // W REST: POST /api/order/sync
  rpc CreateSync (CreateOrderRequest) returns (OrderResponse);
  
  // Pobranie zamówień użytkownika
  // W REST: GET /api/order
  rpc GetByUser (GetOrdersByUserRequest) returns (OrderList);
}

// Żądanie utworzenia zamówienia
message CreateOrderRequest {
  string product_id = 1;
  int32 quantity = 2;
  // user_id wyciągniemy z JWT w metadanych
}

// Odpowiedź z zamówieniem
message OrderResponse {
  OrderDto order = 1;
  bool success = 2;
  string message = 3;
}

// Żądanie zamówień użytkownika
message GetOrdersByUserRequest {
  // user_id wyciągniemy z JWT w metadanych
}

// Lista zamówień
message OrderList {
  repeated OrderDto orders = 1;
}

// DTO zamówienia
message OrderDto {
  string id = 1;                                    // GUID jako string
  string user_id = 2;                               // GUID jako string
  string product_id = 3;
  int32 quantity = 4;
  google.protobuf.Timestamp created_at = 5;         // DateTime
}
```

**Obsługa DateTime:**
Protocol Buffers nie ma natywnego typu DateTime, więc importujemy `google/protobuf/timestamp.proto`. Ten typ automatycznie konwertuje się na DateTime w C#. To standardowy sposób reprezentacji czasu w gRPC.

---

## KROK 3: Modyfikacja UserService {#userservice}

### 3.1 Dodanie pakietów NuGet

Musimy dodać obsługę gRPC do projektu. Zrobimy to przez edycję pliku .csproj.

**Dlaczego te pakiety?**
- `Grpc.AspNetCore` - serwer gRPC dla ASP.NET Core (pozwala hostować usługi gRPC)
- `Grpc.Tools` - narzędzia do kompilacji plików .proto
- `Google.Protobuf` - runtime Protocol Buffers (serializacja/deserializacja)

```xml
<!-- Dodaj do UserService.csproj w sekcji <ItemGroup> -->
<PackageReference Include="Grpc.AspNetCore" Version="2.63.0" />
<PackageReference Include="Grpc.Tools" Version="2.63.0">
  <PrivateAssets>all</PrivateAssets>
  <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
</PackageReference>
<PackageReference Include="Google.Protobuf" Version="3.26.1" />
```

Następnie dodajemy referencję do pliku .proto:

```xml
<!-- Dodaj również w <ItemGroup> -->
<Protobuf Include="../Protos/user.proto" GrpcServices="Server" />
```

**Co robi `GrpcServices="Server"`?**
To mówi kompilatorowi, że ten serwis będzie SERWEREM gRPC (obsługuje żądania). Wartość `Client` użylibyśmy, gdybyśmy chcieli WYWOŁYWAĆ inne serwisy gRPC.

### 3.2 Utworzenie implementacji gRPC Service

Teraz stworzymy klasę, która implementuje serwis zdefiniowany w user.proto. To odpowiednik twojego REST controllera, ale dla gRPC.

```csharp
// UserService/GrpcServices/UserGrpcService.cs

using Grpc.Core;
using GrpcServices.User;
using UserService.Dtos;
using UserService.Services;
using System.Security.Claims;

namespace UserService.GrpcServices
{
    /// <summary>
    /// Implementacja gRPC dla UserService
    /// Odpowiednik AuthController + ProfileController, ale dla gRPC
    /// </summary>
    public class UserGrpcService : User.UserService.UserServiceBase
    {
        private readonly IAuthService _authService;
        private readonly IUserService _userService;
        private readonly ILogger<UserGrpcService> _logger;

        public UserGrpcService(
            IAuthService authService,
            IUserService userService,
            ILogger<UserGrpcService> logger)
        {
            _authService = authService;
            _userService = userService;
            _logger = logger;
        }

        /// <summary>
        /// Rejestracja użytkownika przez gRPC
        /// Odpowiednik POST /api/auth/register
        /// </summary>
        public override async Task<RegisterResponse> Register(
            RegisterRequest request,
            ServerCallContext context)
        {
            try
            {
                _logger.LogInformation(
                    "gRPC: Register called for username: {Username}",
                    request.Username);

                // Konwertujemy z Protobuf na nasz wewnętrzny DTO
                var dto = new RegisterDto
                {
                    Username = request.Username,
                    Password = request.Password
                };

                // Używamy tej samej logiki biznesowej co w REST
                var success = await _authService.RegisterAsync(dto);

                return new RegisterResponse
                {
                    Success = success,
                    Message = success
                        ? "Rejestracja zakończona sukcesem"
                        : "Użytkownik już istnieje"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during gRPC Register");
                
                // W gRPC błędy zgłaszamy przez RpcException
                throw new RpcException(
                    new Status(StatusCode.Internal, ex.Message));
            }
        }

        /// <summary>
        /// Logowanie użytkownika przez gRPC
        /// Odpowiednik POST /api/auth/login
        /// </summary>
        public override async Task<LoginResponse> Login(
            LoginRequest request,
            ServerCallContext context)
        {
            try
            {
                _logger.LogInformation(
                    "gRPC: Login called for username: {Username}",
                    request.Username);

                var dto = new LoginDto
                {
                    Username = request.Username,
                    Password = request.Password
                };

                var token = await _authService.LoginAsync(dto);

                if (token is null)
                {
                    return new LoginResponse
                    {
                        Success = false,
                        Message = "Nieprawidłowe dane logowania"
                    };
                }

                return new LoginResponse
                {
                    Success = true,
                    Token = token,
                    Message = "Zalogowano pomyślnie"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during gRPC Login");
                throw new RpcException(
                    new Status(StatusCode.Internal, ex.Message));
            }
        }

        /// <summary>
        /// Pobranie profilu użytkownika przez gRPC
        /// Odpowiednik GET /api/profile/me
        /// Wymaga uwierzytelnienia - userId wyciągamy z metadanych
        /// </summary>
        public override async Task<UserProfile> GetProfile(
            GetProfileRequest request,
            ServerCallContext context)
        {
            try
            {
                // W gRPC nie mamy HttpContext, ale mamy ServerCallContext
                // Metadane JWT są w context.RequestHeaders
                
                // Pobieramy userId z claims (załóżmy, że middleware JWT już to zrobił)
                var userIdClaim = context.GetHttpContext()
                    .User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId))
                {
                    throw new RpcException(
                        new Status(StatusCode.Unauthenticated, 
                            "Brak autoryzacji"));
                }

                _logger.LogInformation(
                    "gRPC: GetProfile called for userId: {UserId}",
                    userId);

                var userDto = await _userService.GetByIdAsync(userId);

                if (userDto is null)
                {
                    throw new RpcException(
                        new Status(StatusCode.NotFound, 
                            "Użytkownik nie znaleziony"));
                }

                // Konwertujemy z naszego DTO na Protobuf message
                return new UserProfile
                {
                    Id = userDto.Id.ToString(),
                    Username = userDto.Username
                };
            }
            catch (RpcException)
            {
                throw; // Przepuszczamy RpcException dalej
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during gRPC GetProfile");
                throw new RpcException(
                    new Status(StatusCode.Internal, ex.Message));
            }
        }
    }
}
```

**Kluczowe różnice między REST a gRPC w kodzie:**

1. **Obsługa błędów:**
   - REST: zwracamy `StatusCode(400)`, `NotFound()`, itp.
   - gRPC: rzucamy `RpcException` z odpowiednim `StatusCode`

2. **Context:**
   - REST: używamy `HttpContext`
   - gRPC: używamy `ServerCallContext`, ale możemy dostać się do `HttpContext` przez `context.GetHttpContext()`

3. **Routing:**
   - REST: atrybuty `[HttpGet]`, `[Route]`
   - gRPC: metody są automatycznie mapowane z definicji .proto

### 3.3 Rejestracja w Program.cs

Teraz musimy powiedzieć ASP.NET Core, żeby hostował nasz serwis gRPC.

```csharp
// UserService/Program.cs
// Dodaj po builder.Services.AddControllers():

builder.Services.AddGrpc();  // Włącza obsługę gRPC

// ...

// W sekcji app (po app.MapControllers()):

app.MapGrpcService<UserGrpcService>();  // Rejestruje serwis gRPC

// OPCJONALNIE: Włącz reflection dla narzędzi typu grpcurl
if (app.Environment.IsDevelopment())
{
    app.MapGrpcReflectionService();
}
```

**Co to jest gRPC Reflection?**
To mechanizm, który pozwala narzędziom (jak grpcurl, Postman) odkryć, jakie metody oferuje twój serwis, bez potrzeby posiadania pliku .proto. Przydatne do debugowania, ale w produkcji zwykle wyłączane ze względów bezpieczeństwa.

---

## KROK 4: Modyfikacja ProductService {#productservice}

### 4.1 Dodanie pakietów

Dokładnie te same pakiety co w UserService:

```xml
<!-- ProductService.csproj -->
<PackageReference Include="Grpc.AspNetCore" Version="2.63.0" />
<PackageReference Include="Grpc.Tools" Version="2.63.0">
  <PrivateAssets>all</PrivateAssets>
  <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
</PackageReference>
<PackageReference Include="Google.Protobuf" Version="3.26.1" />

<Protobuf Include="../Protos/product.proto" GrpcServices="Server" />
```

### 4.2 Implementacja ProductGrpcService

```csharp
// ProductService/GrpcServices/ProductGrpcService.cs

using Grpc.Core;
using GrpcServices.Product;
using ProductService.Dtos;
using ProductService.Services;
using Google.Protobuf.Collections;

namespace ProductService.GrpcServices
{
    public class ProductGrpcService : Product.ProductService.ProductServiceBase
    {
        private readonly IProductService _productService;
        private readonly ILogger<ProductGrpcService> _logger;

        public ProductGrpcService(
            IProductService productService,
            ILogger<ProductGrpcService> logger)
        {
            _productService = productService;
            _logger = logger;
        }

        /// <summary>
        /// Pobranie wszystkich produktów
        /// W teście k6 to będzie kluczowa operacja do porównania
        /// </summary>
        public override async Task<ProductList> GetAll(
            GetAllProductsRequest request,
            ServerCallContext context)
        {
            try
            {
                _logger.LogInformation("gRPC: GetAll products called");

                var products = await _productService.GetAllAsync();

                // Konwersja z List<ProductDto> na ProductList (protobuf)
                var response = new ProductList();
                
                foreach (var product in products)
                {
                    response.Products.Add(new ProductDto
                    {
                        Id = product.Id,
                        Name = product.Name,
                        Price = (double)product.Price,  // decimal → double
                        Stock = product.Stock
                    });
                }

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during gRPC GetAll");
                throw new RpcException(
                    new Status(StatusCode.Internal, ex.Message));
            }
        }

        /// <summary>
        /// Pobranie produktu po ID
        /// </summary>
        public override async Task<ProductResponse> GetById(
            GetProductByIdRequest request,
            ServerCallContext context)
        {
            try
            {
                _logger.LogInformation(
                    "gRPC: GetById called for product: {Id}",
                    request.Id);

                var product = await _productService.GetByIdAsync(request.Id);

                if (product is null)
                {
                    throw new RpcException(
                        new Status(StatusCode.NotFound, 
                            "Produkt nie znaleziony"));
                }

                return new ProductResponse
                {
                    Success = true,
                    Product = new ProductDto
                    {
                        Id = product.Id,
                        Name = product.Name,
                        Price = (double)product.Price,
                        Stock = product.Stock
                    }
                };
            }
            catch (RpcException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during gRPC GetById");
                throw new RpcException(
                    new Status(StatusCode.Internal, ex.Message));
            }
        }

        /// <summary>
        /// Utworzenie nowego produktu
        /// </summary>
        public override async Task<ProductResponse> Create(
            CreateProductRequest request,
            ServerCallContext context)
        {
            try
            {
                _logger.LogInformation(
                    "gRPC: Create product called: {Name}",
                    request.Name);

                var dto = new CreateProductDto
                {
                    Name = request.Name,
                    Price = (decimal)request.Price,  // double → decimal
                    Stock = request.Stock
                };

                var created = await _productService.CreateAsync(dto);

                if (created is null)
                {
                    throw new RpcException(
                        new Status(StatusCode.Internal, 
                            "Nie udało się utworzyć produktu"));
                }

                return new ProductResponse
                {
                    Success = true,
                    Product = new ProductDto
                    {
                        Id = created.Id,
                        Name = created.Name,
                        Price = (double)created.Price,
                        Stock = created.Stock
                    },
                    Message = "Produkt utworzony pomyślnie"
                };
            }
            catch (RpcException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during gRPC Create");
                throw new RpcException(
                    new Status(StatusCode.Internal, ex.Message));
            }
        }
    }
}
```

**Uwaga o konwersji decimal ↔ double:**
C# używa `decimal` dla wartości pieniężnych (większa precyzja), ale Protocol Buffers ma tylko `double`. W praktyce dla cen produktów różnice są pomijalnie małe, ale w systemach finansowych warto dodać custom serializer dla większej precyzji.

### 4.3 Rejestracja w Program.cs

```csharp
// ProductService/Program.cs

builder.Services.AddGrpc();

// ...

app.MapGrpcService<ProductGrpcService>();

if (app.Environment.IsDevelopment())
{
    app.MapGrpcReflectionService();
}
```

---

## KROK 5: Modyfikacja OrderService {#orderservice}

### 5.1 Dodanie pakietów

```xml
<!-- OrderService.csproj -->
<PackageReference Include="Grpc.AspNetCore" Version="2.63.0" />
<PackageReference Include="Grpc.Tools" Version="2.63.0">
  <PrivateAssets>all</PrivateAssets>
  <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
</PackageReference>
<PackageReference Include="Google.Protobuf" Version="3.26.1" />

<Protobuf Include="../Protos/order.proto" GrpcServices="Server" />
```

### 5.2 Implementacja OrderGrpcService

```csharp
// OrderService/GrpcServices/OrderGrpcService.cs

using Grpc.Core;
using GrpcServices.Order;
using OrderService.Dtos;
using OrderService.Services;
using System.Security.Claims;
using Google.Protobuf.WellKnownTypes;

namespace OrderService.GrpcServices
{
    public class OrderGrpcService : Order.OrderService.OrderServiceBase
    {
        private readonly IOrderService _orderService;
        private readonly ILogger<OrderGrpcService> _logger;

        public OrderGrpcService(
            IOrderService orderService,
            ILogger<OrderGrpcService> logger)
        {
            _orderService = orderService;
            _logger = logger;
        }

        /// <summary>
        /// Utworzenie zamówienia (wersja asynchroniczna z Kafka)
        /// To będzie główny endpoint do testów porównawczych
        /// </summary>
        public override async Task<OrderResponse> Create(
            CreateOrderRequest request,
            ServerCallContext context)
        {
            try
            {
                // Wyciągamy userId z JWT
                var userId = GetUserIdFromContext(context);

                _logger.LogInformation(
                    "gRPC: Create order for user {UserId}, product {ProductId}",
                    userId, request.ProductId);

                var dto = new CreateOrderDto
                {
                    ProductId = request.ProductId,
                    Quantity = request.Quantity
                };

                // Używamy metody asynchronicznej (z Kafka)
                var order = await _orderService.CreateAsync(userId, dto);

                return new OrderResponse
                {
                    Success = true,
                    Order = ConvertToProtobuf(order),
                    Message = "Zamówienie utworzone pomyślnie"
                };
            }
            catch (RpcException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during gRPC Create order");
                throw new RpcException(
                    new Status(StatusCode.Internal, ex.Message));
            }
        }

        /// <summary>
        /// Utworzenie zamówienia (wersja synchroniczna bez Kafka)
        /// Do porównania z wersją asynchroniczną w testach
        /// </summary>
        public override async Task<OrderResponse> CreateSync(
            CreateOrderRequest request,
            ServerCallContext context)
        {
            try
            {
                var userId = GetUserIdFromContext(context);

                _logger.LogInformation(
                    "gRPC: CreateSync order for user {UserId}, product {ProductId}",
                    userId, request.ProductId);

                var dto = new CreateOrderDto
                {
                    ProductId = request.ProductId,
                    Quantity = request.Quantity
                };

                // Używamy metody synchronicznej (bez Kafka)
                var order = await _orderService.CreateSyncAsync(userId, dto);

                return new OrderResponse
                {
                    Success = true,
                    Order = ConvertToProtobuf(order),
                    Message = "Zamówienie utworzone pomyślnie (sync)"
                };
            }
            catch (RpcException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during gRPC CreateSync order");
                throw new RpcException(
                    new Status(StatusCode.Internal, ex.Message));
            }
        }

        /// <summary>
        /// Pobranie zamówień użytkownika
        /// </summary>
        public override async Task<OrderList> GetByUser(
            GetOrdersByUserRequest request,
            ServerCallContext context)
        {
            try
            {
                var userId = GetUserIdFromContext(context);

                _logger.LogInformation(
                    "gRPC: GetByUser orders for user {UserId}",
                    userId);

                var orders = await _orderService.GetByUserAsync(userId);

                var response = new OrderList();
                foreach (var order in orders)
                {
                    response.Orders.Add(ConvertToProtobuf(order));
                }

                return response;
            }
            catch (RpcException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during gRPC GetByUser");
                throw new RpcException(
                    new Status(StatusCode.Internal, ex.Message));
            }
        }

        /// <summary>
        /// Helper: wyciąga userId z kontekstu gRPC
        /// </summary>
        private Guid GetUserIdFromContext(ServerCallContext context)
        {
            var userIdClaim = context.GetHttpContext()
                .User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId))
            {
                throw new RpcException(
                    new Status(StatusCode.Unauthenticated, 
                        "Brak autoryzacji"));
            }

            return userId;
        }

        /// <summary>
        /// Helper: konwersja z C# DTO na Protobuf message
        /// </summary>
        private OrderDto ConvertToProtobuf(OrderService.Dtos.OrderDto order)
        {
            return new OrderDto
            {
                Id = order.Id.ToString(),
                UserId = order.UserId.ToString(),
                ProductId = order.ProductId,
                Quantity = order.Quantity,
                // Konwersja DateTime na Timestamp (Google Protobuf)
                CreatedAt = Timestamp.FromDateTime(
                    DateTime.SpecifyKind(order.CreatedAt, DateTimeKind.Utc))
            };
        }
    }
}
```

**Obsługa DateTime w Protocol Buffers:**
`Timestamp.FromDateTime()` wymaga czasu w UTC. Jeśli twój `CreatedAt` nie jest explicitly UTC, musisz to zaznaczyć przez `DateTime.SpecifyKind()`. To częsty błąd - jeśli zapomn tego, dostaniesz ArgumentException.

### 5.3 Rejestracja w Program.cs

```csharp
// OrderService/Program.cs

builder.Services.AddGrpc();

// ...

app.MapGrpcService<OrderGrpcService>();

if (app.Environment.IsDevelopment())
{
    app.MapGrpcReflectionService();
}
```

---

## KROK 6: Konfiguracja ApiGateway {#apigateway}

To jest najtrudniejsza część. API Gateway musi umieć routować zarówno REST, jak i gRPC.

### 6.1 Problem do rozwiązania

YARP (twój obecny reverse proxy) w wersji 2.3.0 nie obsługuje natywnie gRPC. Masz dwie opcje:

**Opcja A: Bezpośrednie połączenia gRPC (prostsze)**
- Test k6 łączy się bezpośrednio z serwisami przez gRPC
- Pomijamy API Gateway dla testów gRPC
- API Gateway pozostaje tylko dla REST

**Opcja B: Upgrade YARP + gRPC proxy (bardziej realistyczne)**
- Upgrade YARP do nowszej wersji z obsługą gRPC
- API Gateway routuje zarówno REST jak i gRPC
- Bardziej przypomina prawdziwą produkcję

**Polecam Opcję A dla początkowych testów** - jest prostsza i pozwala skupić się na różnicach REST vs gRPC. Później możesz dodać Opcję B.

### 6.2 Opcja A: Routing dla testów

W testach k6 będziesz miał dwie ścieżki:

**REST (przez API Gateway):**
```
k6 → http://apigateway:80/api/user/register → YARP → UserService:80
```

**gRPC (bezpośrednio):**
```
k6 → grpc://userservice:80 → UserService gRPC
```

Dla testów sprawiedliwych, upewnij się, że w obu przypadkach przechodzisz przez sieć Kubernetes (nie localhost).

### 6.3 Opcja B: YARP z gRPC (opcjonalna)

Jeśli chcesz pełną integrację:

```xml
<!-- ApiGatewayService.csproj -->
<!-- Upgrade YARP -->
<PackageReference Include="Yarp.ReverseProxy" Version="2.3.0" Update="3.0.0" />

<!-- Dodaj obsługę gRPC -->
<PackageReference Include="Grpc.AspNetCore" Version="2.63.0" />
```

```csharp
// ApiGatewayService/Program.cs

builder.Services.AddGrpc();  // Dodaj obsługę gRPC

// Konfiguracja YARP z gRPC
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
    .AddTransforms(context =>
    {
        // Włącz przekierowanie HTTP/2 dla gRPC
        context.AddRequestTransform(async transformContext =>
        {
            if (transformContext.HttpContext.Request.ContentType?.Contains("application/grpc") == true)
            {
                transformContext.ProxyRequest.Version = new Version(2, 0);
                transformContext.ProxyRequest.VersionPolicy = HttpVersionPolicy.RequestVersionExact;
            }
        });
    });
```

Następnie w appsettings.json dodaj routing dla gRPC:

```json
"ReverseProxy": {
  "Routes": {
    // ... istniejące REST routes ...
    
    "grpc-user-route": {
      "ClusterId": "user-service",
      "Match": {
        "Path": "/user.UserService/{**catch-all}",
        "Headers": [
          {
            "Name": "content-type",
            "Values": ["application/grpc"],
            "Mode": "Contains"
          }
        ]
      }
    },
    "grpc-product-route": {
      "ClusterId": "product-service",
      "Match": {
        "Path": "/product.ProductService/{**catch-all}",
        "Headers": [
          {
            "Name": "content-type",
            "Values": ["application/grpc"],
            "Mode": "Contains"
          }
        ]
      }
    },
    "grpc-order-route": {
      "ClusterId": "order-service",
      "Match": {
        "Path": "/order.OrderService/{**catch-all}",
        "Headers": [
          {
            "Name": "content-type",
            "Values": ["application/grpc"],
            "Mode": "Contains"
          }
        ]
      }
    }
  }
}
```

**Dlaczego ten routing działa?**
gRPC używa path w formacie `/{package}.{Service}/{Method}`. Np. wywołanie metody `Register` z `user.proto` idzie na path `/user.UserService/Register`. YARP może to zmatchować i przekierować do właściwego serwisu.

---

## KROK 7: Weryfikacja i testy {#weryfikacja}

### 7.1 Testy lokalne - grpcurl

Zainstaluj grpcurl (klient gRPC z CLI):

```bash
# Linux/Mac
brew install grpcurl

# Windows
scoop install grpcurl
```

Testuj każdy serwis:

```bash
# UserService - Rejestracja
grpcurl -plaintext -d '{
  "username": "testuser",
  "password": "testpass123"
}' localhost:5185 user.UserService/Register

# UserService - Logowanie
grpcurl -plaintext -d '{
  "username": "testuser",
  "password": "testpass123"
}' localhost:5185 user.UserService/Login

# ProductService - Lista produktów
grpcurl -plaintext \
  localhost:5282 product.ProductService/GetAll

# OrderService - Utworzenie zamówienia (z tokenem)
grpcurl -plaintext \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"product_id": "some_id", "quantity": 2}' \
  localhost:5093 order.OrderService/Create
```

### 7.2 Checklist weryfikacji

Przed przejściem do testów k6, upewnij się, że:

- [ ] Wszystkie pliki .proto kompilują się bez błędów
- [ ] UserService odpowiada na Register i Login przez gRPC
- [ ] ProductService zwraca listę produktów przez gRPC
- [ ] OrderService tworzy zamówienie przez gRPC (z tokenem JWT)
- [ ] REST API nadal działa (nie zepsułeś istniejącej funkcjonalności)
- [ ] Logi pokazują jasno, które żądania idą przez REST, a które przez gRPC

### 7.3 Docker Compose - aktualizacja

Upewnij się, że porty gRPC są wystawione:

```yaml
# docker-compose.yml

services:
  userservice:
    ports:
      - "5185:80"  # HTTP/2 (gRPC) i HTTP/1.1 (REST) na tym samym porcie
    environment:
      - ASPNETCORE_URLS=http://+:80
      - ASPNETCORE_HTTP_PROTOCOLS=Http1AndHttp2  # KLUCZOWE!
```

**Dlaczego `Http1AndHttp2`?**
ASP.NET Core musi obsługiwać oba protokoły jednocześnie - HTTP/1.1 dla REST i HTTP/2 dla gRPC. Bez tego ustawienia, gRPC może nie działać.

---

## Podsumowanie zmian

### Co zostało dodane:

1. **3 pliki .proto** - definicje kontraktów
2. **3 klasy GrpcService** - implementacje serwerów gRPC
3. **Pakiety NuGet** - Grpc.AspNetCore, Grpc.Tools, Google.Protobuf
4. **Konfiguracja** - MapGrpcService() w każdym serwisie

### Co pozostało nienaruszone:

- Wszystkie istniejące REST controllery
- Logika biznesowa (IOrderService, IProductService, itd.)
- Bazy danych i Kafka
- API Gateway (jeśli używasz Opcji A)

### Architektura docelowa:

```
        ┌─────────────┐
        │   k6 Test   │
        └──────┬──────┘
               │
        ┌──────┴──────┐
        │             │
     REST           gRPC
        │             │
        ▼             ▼
  ┌──────────┐  ┌──────────┐
  │   YARP   │  │ Services │
  │ Gateway  │  │ directly │
  └────┬─────┘  └─────┬────┘
       │              │
       └──────┬───────┘
              │
      ┌───────┴────────┐
      │   Services     │
      │ - UserService  │
      │ - ProductSvc   │
      │ - OrderService │
      └────────────────┘
```

---

## Następne kroki

Teraz jesteś gotów do przygotowania testów k6! Będą one obejmowały:

1. **Scenariusz REST** - pełny flow przez HTTP JSON
2. **Scenariusz gRPC** - pełny flow przez gRPC Protobuf
3. **Metryki do porównania:**
   - Latencja (p50, p95, p99)
   - Throughput (req/s)
   - Rozmiar payloadu (network usage)
   - Wykorzystanie CPU/RAM

Powiedz mi, kiedy będziesz gotów, a przygotuję skrypty k6 dla obu scenariuszy!
