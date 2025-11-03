using OrderService.Dtos;

namespace OrderService.Services
{
    public interface IOrderService
    {
        /// <summary>
        /// Tworzy zamówienie asynchronicznie - publikuje do Kafki
        /// </summary>
        Task<OrderDto> CreateAsync(Guid userId, CreateOrderDto dto);

        /// <summary>
        /// Tworzy zamówienie synchronicznie - bez publikacji do Kafki
        /// </summary>
        Task<OrderDto> CreateSyncAsync(Guid userId, CreateOrderDto dto);

        Task<IEnumerable<OrderDto>> GetByUserAsync(Guid userId);
    }
}
