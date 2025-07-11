using OrderService.Dtos;

namespace OrderService.Services
{
    public interface IOrderService
    {
        Task<OrderDto> CreateAsync(Guid userId, CreateOrderDto dto);
        Task<IEnumerable<OrderDto>> GetByUserAsync(Guid userId);
    }
}
