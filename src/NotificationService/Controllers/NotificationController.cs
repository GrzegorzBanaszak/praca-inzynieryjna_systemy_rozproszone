using Microsoft.AspNetCore.Mvc;
using NotificationService.Dtos;
using NotificationService.Services;

namespace NotificationService.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class NotificationController : ControllerBase
    {
        private readonly INotificationService _notificationService;
        private readonly ILogger<NotificationController> _logger;

        public NotificationController(
            INotificationService notificationService,
            ILogger<NotificationController> logger)
        {
            _notificationService = notificationService;
            _logger = logger;
        }

        /// <summary>
        /// Synchroniczny endpoint do wysyłania notyfikacji o zamówieniu.
        /// Wywoływany bezpośrednio przez OrderService w scenariuszu synchronicznym.
        /// </summary>
        [HttpPost("send")]
        public async Task<IActionResult> SendNotification([FromBody] OrderDto order)
        {
            try
            {
                _logger.LogInformation(
                    "Received synchronous notification request for order {OrderId}",
                    order.Id);

                // Wywołujemy tę samą logikę, która jest używana przez Kafka consumer
                await _notificationService.NotifyAsync(order);

                _logger.LogInformation(
                    "Successfully processed synchronous notification for order {OrderId}",
                    order.Id);

                return Ok(new { Success = true, OrderId = order.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error processing synchronous notification for order {OrderId}",
                    order.Id);

                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }

        /// <summary>
        /// Endpoint zdrowia - pomocny do testowania czy serwis odpowiada
        /// </summary>
        [HttpGet("health")]
        public IActionResult Health()
        {
            return Ok(new { Status = "Healthy", Service = "NotificationService" });
        }
    }
}