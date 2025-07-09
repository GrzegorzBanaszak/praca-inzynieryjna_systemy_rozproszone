using Microsoft.AspNetCore.Mvc;
using ProductService.Dtos;
using ProductService.Services;

namespace ProductService.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProductController : ControllerBase
    {
        private readonly IProductService _svc;
        public ProductController(IProductService svc) => _svc = svc;

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProductDto>>> Get() =>
            Ok(await _svc.GetAllAsync());

        [HttpGet("{id:length(24)}")]
        public async Task<ActionResult<ProductDto>> Get(string id)
        {
            var dto = await _svc.GetByIdAsync(id);
            return dto is null ? NotFound() : Ok(dto);
        }

        [HttpPost]
        public async Task<ActionResult<ProductDto>> Post([FromBody] CreateProductDto product)
        {
            var createdProduct = await _svc.CreateAsync(product);
            return CreatedAtAction(nameof(Get), new { id = createdProduct?.Id }, createdProduct);
        }

        [HttpGet("healthz")]
        public IActionResult Health() => Ok("Healthy");
    }
}
