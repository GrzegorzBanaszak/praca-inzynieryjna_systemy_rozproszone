using AutoMapper;
using OrderService.Dtos;
using OrderService.Models;

namespace OrderService.Profiles
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            CreateMap<Order, OrderDto>();
            CreateMap<CreateOrderDto, Order>();
        }
    }
}
