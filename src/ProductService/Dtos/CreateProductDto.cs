using System.ComponentModel.DataAnnotations;

namespace ProductService.Dtos
{
    public class CreateProductDto
    {
        [Required]
        public string Name { get; set; } = default!;

        [Range(0.01, double.MaxValue)]
        public decimal Price { get; set; }

        [Range(0, int.MaxValue)]
        public int Stock { get; set; }
    }
}
