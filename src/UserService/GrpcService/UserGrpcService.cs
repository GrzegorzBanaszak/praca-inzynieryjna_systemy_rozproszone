using Grpc.Core;
using GrpcServices.User;
using UserService.Dtos;
using UserService.Services;
using System.Security.Claims;

namespace UserService.GrpcService
{
    /// <summary>
    /// Implementacja gRPC dla UserService
    /// Odpowiednik AuthController + ProfileController, ale dla gRPC
    /// </summary>
    public class UserGrpcService : GrpcServices.User.UserService.UserServiceBase
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