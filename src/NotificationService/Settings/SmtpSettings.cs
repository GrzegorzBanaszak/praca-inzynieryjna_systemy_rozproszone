using System;

namespace NotificationService.Settings;

public class SmtpSettings
{
    public string Host { get; set; } = null!;
    public int Port { get; set; }
    public string User { get; set; } = null!;
    public string Pass { get; set; } = null!;
}
