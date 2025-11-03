using System;

namespace NotificationService.Dtos;

public class OrderDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string ProductId { get; set; } = null!;
    public int Quantity { get; set; }
    public DateTime CreatedAt { get; set; }
}
