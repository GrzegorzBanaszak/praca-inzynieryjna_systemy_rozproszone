using Microsoft.EntityFrameworkCore;
using OrderService.Models;

namespace OrderService.Data
{
    public class OrderDbContext : DbContext
    {
        public OrderDbContext(DbContextOptions<OrderDbContext> opts) : base(opts) { }
        public DbSet<Order> Orders { get; set; } = null!;
    }
}
