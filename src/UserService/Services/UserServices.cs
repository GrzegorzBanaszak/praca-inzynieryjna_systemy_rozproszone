using System;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using UserService.Data;
using UserService.Dtos;

namespace UserService.Services;

public class UserServices : IUserService
{
    private readonly UserDbContext _db;
    private readonly IMapper _mapper;

    public UserServices(UserDbContext db, IMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    public async Task<UserDto?> GetByIdAsync(Guid id)
    {
        var user = await _db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id);

        return user is null ? null : _mapper.Map<UserDto>(user);
    }
}
