using AutoMapper;
using UserService.Dtos;
using UserService.Models;

namespace UserService.Mapper
{
    public class UserProfile : Profile
    {
        public UserProfile()
        {
            CreateMap<User, UserDto>(); // Map User to UserDto>

        }
    }
}
