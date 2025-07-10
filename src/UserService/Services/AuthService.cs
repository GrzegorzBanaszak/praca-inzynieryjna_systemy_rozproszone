using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using UserService.Data;
using UserService.Dtos;
using UserService.Models;
using UserService.Settings;

namespace UserService.Services
{
    public class AuthService : IAuthService
    {
        private readonly UserDbContext _userRepository;
        private readonly JwtSettings _jwt;

        public AuthService(UserDbContext userRepository, IOptions<JwtSettings> jwtOptions)
        {
            _userRepository = userRepository;
            _jwt = jwtOptions.Value;
        }

        public async Task<bool> RegisterAsync(RegisterDto dto)
        {
            if (await _userRepository.Users.AnyAsync(u => u.Username == dto.Username))
                return false; // User already exists

            using var hmac = new HMACSHA512();
            var User = new User
            {
                Id = Guid.NewGuid(),
                Username = dto.Username,
                PasswordSalt = hmac.Key,
                PasswordHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(dto.Password))
            };

            _userRepository.Users.Add(User);
            await _userRepository.SaveChangesAsync();

            return true; // Registration successful

        }

        public async Task<string?> LoginAsync(LoginDto dto)
        {
            var user = await _userRepository.Users
                .SingleOrDefaultAsync(u => u.Username == dto.Username);

            if (user is null || !VerifyPassword(dto.Password, user))
                return null;

            var claims = new[]
            {
                 new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                 new Claim(ClaimTypes.Name,user.Username)
            };


            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Key));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var expires = DateTime.UtcNow.AddMinutes(_jwt.ExpirationMinutes);


            var token = new JwtSecurityToken(
                 issuer: _jwt.Issuer,
                 audience: _jwt.Audience,
                 claims: claims,
                 expires: expires,
                 signingCredentials: creds
             );

            return new JwtSecurityTokenHandler().WriteToken(token); // Return the JWT token

        }

        // Pomocnicza weryfikacja hasła
        private static bool VerifyPassword(string password, User user)
        {
            using var hmac = new HMACSHA512(user.PasswordSalt);
            var computed = hmac.ComputeHash(Encoding.UTF8.GetBytes(password));
            return computed.SequenceEqual(user.PasswordHash);
        }


    }
}
