using Grpc.Core;
using GrpcServices.Product;
using ProductService.Dtos;
using ProductService.Services;
using Google.Protobuf.Collections;

namespace ProductService.GrpcService
{
    public class ProductGrpcService : GrpcServices.Product.ProductService.ProductServiceBase
    {
        private readonly IProductService _productService;
        private readonly ILogger<ProductGrpcService> _logger;

        public ProductGrpcService(
            IProductService productService,
            ILogger<ProductGrpcService> logger)
        {
            _productService = productService;
            _logger = logger;
        }

        /// <summary>
        /// Pobranie wszystkich produktów
        /// W teście k6 to będzie kluczowa operacja do porównania
        /// </summary>
        public override async Task<ProductList> GetAll(
            GetAllProductsRequest request,
            ServerCallContext context)
        {
            try
            {
                _logger.LogInformation("gRPC: GetAll products called");

                var products = await _productService.GetAllAsync();

                // Konwersja z List<ProductDto> na ProductList (protobuf)
                var response = new ProductList();

                foreach (var product in products)
                {
                    response.Products.Add(new GrpcServices.Product.ProductDto
                    {
                        Id = product.Id,
                        Name = product.Name,
                        Price = (double)product.Price,  // decimal → double
                        Stock = product.Stock
                    });
                }

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during gRPC GetAll");
                throw new RpcException(
                    new Status(StatusCode.Internal, ex.Message));
            }
        }

        /// <summary>
        /// Pobranie produktu po ID
        /// </summary>
        public override async Task<ProductResponse> GetById(
            GetProductByIdRequest request,
            ServerCallContext context)
        {
            try
            {
                _logger.LogInformation(
                    "gRPC: GetById called for product: {Id}",
                    request.Id);

                var product = await _productService.GetByIdAsync(request.Id);

                if (product is null)
                {
                    throw new RpcException(
                        new Status(StatusCode.NotFound,
                            "Produkt nie znaleziony"));
                }

                return new ProductResponse
                {
                    Success = true,
                    Product = new GrpcServices.Product.ProductDto
                    {
                        Id = product.Id,
                        Name = product.Name,
                        Price = (double)product.Price,
                        Stock = product.Stock
                    }
                };
            }
            catch (RpcException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during gRPC GetById");
                throw new RpcException(
                    new Status(StatusCode.Internal, ex.Message));
            }
        }

        /// <summary>
        /// Utworzenie nowego produktu
        /// </summary>
        public override async Task<ProductResponse> Create(
            CreateProductRequest request,
            ServerCallContext context)
        {
            try
            {
                _logger.LogInformation(
                    "gRPC: Create product called: {Name}",
                    request.Name);

                var dto = new CreateProductDto
                {
                    Name = request.Name,
                    Price = (decimal)request.Price,  // double → decimal
                    Stock = request.Stock
                };

                var created = await _productService.CreateAsync(dto);

                if (created is null)
                {
                    throw new RpcException(
                        new Status(StatusCode.Internal,
                            "Nie udało się utworzyć produktu"));
                }

                return new ProductResponse
                {
                    Success = true,
                    Product = new GrpcServices.Product.ProductDto
                    {
                        Id = created.Id,
                        Name = created.Name,
                        Price = (double)created.Price,
                        Stock = created.Stock
                    },
                    Message = "Produkt utworzony pomyślnie"
                };
            }
            catch (RpcException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during gRPC Create");
                throw new RpcException(
                    new Status(StatusCode.Internal, ex.Message));
            }
        }
    }
}