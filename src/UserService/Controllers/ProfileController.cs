using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using UserService.Dtos;
using UserService.Services;

namespace UserService.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProfileController : ControllerBase
    {
        private readonly IUserService _userService;

        public ProfileController(IUserService userService)
        {
            _userService = userService;
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<ActionResult<UserDto>> GetProfile()
        {

            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (idClaim is null || !Guid.TryParse(idClaim, out var userId))
                return Unauthorized();

            var dto = await _userService.GetByIdAsync(userId);
            return dto is null ? NotFound() : Ok(dto);
        }
    }
}
