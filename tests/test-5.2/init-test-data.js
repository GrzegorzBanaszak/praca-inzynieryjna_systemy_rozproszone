import http from "k6/http";
import { check, sleep } from "k6";

// ZMIEŃ NA ADRES SWOJEGO API GATEWAY
const BASE_URL = __ENV.BASE_URL || "http://distributed.local";

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  console.log("=== Inicjalizacja danych testowych ===");
  console.log(`Base URL: ${BASE_URL}`);

  const headers = { "Content-Type": "application/json" };

  // Lista produktów do dodania
  const products = [
    { name: "Laptop Dell XPS 15", price: 5999.99, stock: 50 },
    { name: "iPhone 15 Pro", price: 4999.0, stock: 100 },
    { name: "Samsung Galaxy S24", price: 3999.0, stock: 75 },
    { name: "MacBook Pro M3", price: 8999.0, stock: 30 },
    { name: "iPad Air", price: 2999.0, stock: 60 },
    { name: "Sony WH-1000XM5", price: 1499.0, stock: 120 },
    { name: "AirPods Pro", price: 1099.0, stock: 200 },
    { name: 'Samsung 55" QLED TV', price: 3499.0, stock: 40 },
    { name: "PlayStation 5", price: 2299.0, stock: 80 },
    { name: "Xbox Series X", price: 2199.0, stock: 85 },
    { name: "Nintendo Switch OLED", price: 1499.0, stock: 150 },
    { name: "Logitech MX Master 3S", price: 449.0, stock: 300 },
    { name: "Mechanical Keyboard RGB", price: 599.0, stock: 250 },
    { name: 'LG 27" 4K Monitor', price: 1899.0, stock: 90 },
    { name: "Canon EOS R6", price: 12999.0, stock: 25 },
    { name: "GoPro Hero 12", price: 1899.0, stock: 110 },
    { name: "DJI Mavic 3", price: 8999.0, stock: 35 },
    { name: "Amazon Echo Dot", price: 199.0, stock: 500 },
    { name: "Google Nest Hub", price: 399.0, stock: 400 },
    { name: "Apple Watch Series 9", price: 2499.0, stock: 150 },
  ];

  let addedCount = 0;
  let failedCount = 0;

  console.log(`\nDodawanie ${products.length} produktów...`);

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const payload = JSON.stringify(product);

    const response = http.post(`${BASE_URL}/api/product`, payload, {
      headers: headers,
    });

    const success = check(response, {
      "status is 201 or 200": (r) => r.status === 201 || r.status === 200,
    });

    if (success) {
      addedCount++;
      console.log(`✓ [${i + 1}/${products.length}] Dodano: ${product.name}`);
    } else {
      failedCount++;
      console.log(
        `✗ [${i + 1}/${products.length}] Błąd (${response.status}): ${
          product.name
        }`
      );
    }

    sleep(0.1); // Krótka pauza między dodawaniem
  }

  console.log("\n=== Podsumowanie ===");
  console.log(`Dodane produkty: ${addedCount}`);
  console.log(`Błędy: ${failedCount}`);

  // Sprawdzenie co znajduje się w bazie
  sleep(1);
  const listResponse = http.get(`${BASE_URL}/api/product`, {
    headers: headers,
  });

  if (listResponse.status === 200) {
    const productList = listResponse.json();
    console.log(`\n✓ Produkty w bazie: ${productList.length}`);

    if (productList.length > 0) {
      console.log("\nPrzykładowe produkty:");
      productList.slice(0, 5).forEach((p, idx) => {
        console.log(
          `  ${idx + 1}. ${p.name} - ${p.price} PLN (stock: ${p.stock})`
        );
      });

      if (productList.length > 5) {
        console.log(`  ... i ${productList.length - 5} więcej`);
      }
    }
  } else {
    console.log(`\n✗ Błąd pobierania listy produktów: ${listResponse.status}`);
  }

  console.log("\n===================");
  console.log("✓ Inicjalizacja zakończona!");
  console.log(
    "Możesz teraz uruchomić test wydajnościowy: k6 run test-5.2-performance.js"
  );
  console.log("===================\n");
}
