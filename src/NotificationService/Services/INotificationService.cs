using NotificationService.Dtos;

namespace NotificationService.Services;

public interface INotificationService
{
    Task NotifyAsync(OrderDto order);
}
