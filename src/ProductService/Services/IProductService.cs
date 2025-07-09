using ProductService.Dtos;

namespace ProductService.Services
{
    public interface IProductService
    {
        Task<List<ProductDto>> GetAllAsync();
        Task<ProductDto?> GetByIdAsync(string id);
        Task<ProductDto?> CreateAsync(CreateProductDto product);
    }
}
