using Microsoft.AspNetCore.Mvc;
using UserService.Dtos;
using UserService.Services;

namespace UserService.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _svc;
        public AuthController(IAuthService svc) => _svc = svc;

        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterDto dto)
        {
            var ok = await _svc.RegisterAsync(dto);
            return ok ? Ok() : BadRequest("User already exists");
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            var token = await _svc.LoginAsync(dto);
            return token is null ? Unauthorized() : Ok(new { Token = token });
        }
    }
}
