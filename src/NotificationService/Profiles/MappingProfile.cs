using System;
using AutoMapper;
using NotificationService.Dtos;

namespace NotificationService.Profiles;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<OrderDto, OrderDto>(); // Identity map, ale można rozszerzyć
    }
}
