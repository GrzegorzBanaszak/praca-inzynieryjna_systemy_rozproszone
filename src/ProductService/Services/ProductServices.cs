using AutoMapper;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using ProductService.Dtos;
using ProductService.Models;
using ProductService.Settings;

namespace ProductService.Services
{
    public class ProductServices : IProductService
    {
        private readonly IMongoCollection<Product> _products;
        private readonly IMapper _mapper;

        public ProductServices(IOptions<MongoDbSettings> settings, IMapper mapper)
        {
            var client = new MongoClient(settings.Value.ConnectionString);
            var db = client.GetDatabase(settings.Value.DatabaseName);
            _products = db.GetCollection<Product>(settings.Value.CollectionName);
            _mapper = mapper;
        }

        public async Task<List<ProductDto>> GetAllAsync()
        {
            var data = await _products.Find(_ => true).ToListAsync();

            return _mapper.Map<List<ProductDto>>(data);
        }
        public async Task<ProductDto?> GetByIdAsync(string id)
        {
            var p = await _products.Find(x => x.Id == id).FirstOrDefaultAsync();
            return p is null
                ? null
                : _mapper.Map<ProductDto>(p);
        }
        public async Task<ProductDto?> CreateAsync(CreateProductDto product)
        {
            var newProduct = _mapper.Map<Product>(product);

            await _products.InsertOneAsync(newProduct);

            return _mapper.Map<ProductDto>(newProduct);
        }




    }
}
