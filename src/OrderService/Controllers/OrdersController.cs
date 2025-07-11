using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Dtos;
using OrderService.Services;
using System.Security.Claims;

namespace OrderService.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class OrdersController : ControllerBase
    {
        private readonly IOrderService _svc;
        public OrdersController(IOrderService svc) => _svc = svc;

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

        [HttpGet("healthz")]
        [AllowAnonymous]
        public IActionResult Health() => Ok("Healthy");

    }
}
