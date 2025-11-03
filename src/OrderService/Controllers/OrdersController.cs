using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Dtos;
using OrderService.Services;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace OrderService.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class OrdersController : ControllerBase
    {
        private readonly IOrderService _svc;
        private readonly IHttpClientFactory _httpClientFactory;
        public OrdersController(IOrderService svc, IHttpClientFactory httpClientFactory)
        {
            _svc = svc;
            _httpClientFactory = httpClientFactory;
        }

        [HttpPost]
        public async Task<ActionResult<OrderDto>> Post([FromBody] CreateOrderDto order)
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(idClaim, out var userId))
                return Unauthorized();

            var result = await _svc.CreateAsync(userId, order);
            return CreatedAtAction(nameof(GetByUser), new { userId = userId }, result);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<OrderDto>>> GetByUser()
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(idClaim, out var userId))
                return Unauthorized();

            var list = await _svc.GetByUserAsync(userId);
            return Ok(list);
        }

        [HttpPost("sync")]
        public async Task<ActionResult<OrderDto>> PostSync([FromBody] CreateOrderDto order)
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(idClaim, out var userId))
                return Unauthorized();

            var overallStartTime = DateTime.UtcNow;

            // Krok 1: Utworzenie zamówienia w bazie (bez publikacji do Kafki)
            var createStartTime = DateTime.UtcNow;
            var result = await _svc.CreateSyncAsync(userId, order);
            var createDuration = (DateTime.UtcNow - createStartTime).TotalMilliseconds;



            // Krok 2: Synchroniczne wywołanie NotificationService
            var notificationStartTime = DateTime.UtcNow;
            try
            {
                var httpClient = _httpClientFactory.CreateClient("NotificationService");
                var jsonContent = JsonSerializer.Serialize(result);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                var response = await httpClient.PostAsync("/api/notification/send", content);
                var notificationDuration = (DateTime.UtcNow - notificationStartTime).TotalMilliseconds;

                if (!response.IsSuccessStatusCode)
                {


                    // Zamówienie zostało utworzone, ale notyfikacja się nie powiodła
                    return StatusCode(207, new
                    {
                        Order = result,
                        NotificationStatus = "Failed",
                        Message = "Order created but notification failed"
                    });
                }


            }
            catch (Exception ex)
            {


                // Zamówienie zostało utworzone, ale wystąpił błąd podczas notyfikacji
                return StatusCode(207, new
                {
                    Order = result,
                    NotificationStatus = "Error",
                    Message = $"Order created but notification error: {ex.Message}"
                });
            }

            var overallDuration = (DateTime.UtcNow - overallStartTime).TotalMilliseconds;


            return CreatedAtAction(nameof(GetByUser), new { userId = userId }, result);
        }

        [HttpGet("healthz")]
        [AllowAnonymous]
        public IActionResult Health() => Ok("Healthy");

    }
}
