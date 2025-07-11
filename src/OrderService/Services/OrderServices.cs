using AutoMapper;
using Confluent.Kafka;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OrderService.Data;
using OrderService.Dtos;
using OrderService.Models;
using OrderService.Settings;
using System.Text.Json;

namespace OrderService.Services
{
    public class OrderServices : IOrderService
    {
        private readonly OrderDbContext _db;
        private readonly IMapper _mapper;
        private readonly IProducer<Null, string> _producer;
        private readonly KafkaSettings _kafka;

        public OrderServices(
            OrderDbContext db,
            IMapper mapper,
            IOptions<KafkaSettings> kafkaOptions,
            IProducer<Null, string> producer)
        {
            _db = db;
            _mapper = mapper;
            _producer = producer;
            _kafka = kafkaOptions.Value;
        }


        public async Task<OrderDto> CreateAsync(Guid userId, CreateOrderDto dto)
        {
            var order = _mapper.Map<Order>(dto);
            order.Id = Guid.NewGuid();
            order.UserId = userId;

            _db.Orders.Add(order);

            await _db.SaveChangesAsync();

            var orderDto = _mapper.Map<OrderDto>(order);
            var payload = JsonSerializer.Serialize(orderDto);

            await _producer.ProduceAsync(
                _kafka.Topic,
                new Message<Null, string> { Value = payload });

            return orderDto;

        }

        public async Task<IEnumerable<OrderDto>> GetByUserAsync(Guid userId)
        {
            var orders = await _db.Orders
                .Where(o => o.UserId == userId)
                .ToListAsync();

            return _mapper.Map<IEnumerable<OrderDto>>(orders);
        }
    }
}
