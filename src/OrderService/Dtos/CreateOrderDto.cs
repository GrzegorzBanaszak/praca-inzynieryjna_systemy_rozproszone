namespace OrderService.Dtos
{
    public class CreateOrderDto
    {
        public string ProductId { get; set; } = default!;
        public int Quantity { get; set; }
    }
}
