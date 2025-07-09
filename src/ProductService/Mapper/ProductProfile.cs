using AutoMapper;
using ProductService.Dtos;
using ProductService.Models;

namespace ProductService.Mapper
{
    public class ProductProfile : Profile
    {
        public ProductProfile()
        {
            CreateMap<Product, ProductDto>();
            CreateMap<CreateProductDto, Product>();
        }
    }
}
