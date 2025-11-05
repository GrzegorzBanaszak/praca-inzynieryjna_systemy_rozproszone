using Grpc.Core;
using GrpcServices.Order;
using OrderService.Dtos;
using OrderService.Services;
using System.Security.Claims;
using Google.Protobuf.WellKnownTypes;

namespace OrderService.GrpcService
{
    public class OrderGrpcService : GrpcServices.Order.OrderService.OrderServiceBase
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
        private GrpcServices.Order.OrderDto ConvertToProtobuf(OrderService.Dtos.OrderDto order)
        {
            return new GrpcServices.Order.OrderDto
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