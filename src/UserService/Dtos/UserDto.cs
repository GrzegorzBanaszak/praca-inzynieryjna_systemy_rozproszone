using System;

namespace UserService.Dtos;

public class UserDto
{
    public Guid Id { get; set; }
    public string Username { get; set; } = null!;
}
