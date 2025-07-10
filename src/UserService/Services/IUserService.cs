using System;
using UserService.Dtos;

namespace UserService.Services;

public interface IUserService
{
    Task<UserDto?> GetByIdAsync(Guid id);
}
