namespace ProductService.Settings
{
    public class MongoDbSettings
    {
        /// <summary>
        /// Connection string do serwera MongoDB, np. "mongodb://localhost:27017"
        /// </summary>
        public string ConnectionString { get; set; } = null!;

        /// <summary>
        /// Nazwa bazy danych, np. "ProductDb"
        /// </summary>
        public string DatabaseName { get; set; } = null!;

        /// <summary>
        /// Nazwa kolekcji przechowującej dokumenty produktów, np. "Products"
        /// </summary>
        public string CollectionName { get; set; } = null!;
    }
}
