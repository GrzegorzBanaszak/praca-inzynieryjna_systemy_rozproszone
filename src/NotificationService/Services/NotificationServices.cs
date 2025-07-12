using System;
using Microsoft.Extensions.Options;
using NotificationService.Dtos;
using NotificationService.Settings;

namespace NotificationService.Services;

public class NotificationServices : INotificationService
{
    private readonly SmtpSettings _smtp;
    private readonly ILogger<NotificationServices> _logger;

    public NotificationServices(
        IOptions<SmtpSettings> smtpOptions,
        ILogger<NotificationServices> logger)
    {
        _smtp = smtpOptions.Value;
        _logger = logger;
    }
    public Task NotifyAsync(OrderDto order)
    {
        // tu możesz zbudować prawdziwego maila; na razie logujemy
        _logger.LogInformation("NOTIFY: Zamówienie {OrderId} złożone przez {UserId}, produkt {ProductId}, ilość {Quantity}",
            order.Id, order.UserId, order.ProductId, order.Quantity);
        return Task.CompletedTask;
    }
}
