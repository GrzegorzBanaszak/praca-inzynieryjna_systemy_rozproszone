import http from "k6/http";
import { check, sleep } from "k6";

// Konfiguracja testu K6
export const options = {
  vus: 1, // Jeden wirtualny użytkownik - wystarczy do seedowania danych
  iterations: 1, // Jedno wykonanie - tworzymy dane tylko raz
  thresholds: {
    http_req_failed: ["rate<0.1"], // Mniej niż 10% requestów może się nie udać
    http_req_duration: ["p(95)<2000"], // 95% requestów powinno trwać krócej niż 2s
  },
};

// Tablica 10 testowych produktów z różnorodnymi danymi
const testProducts = [
  {
    name: "Laptop Dell XPS 15",
    price: 5499.99,
    stock: 15,
  },
  {
    name: "Klawiatura mechaniczna Logitech",
    price: 399.0,
    stock: 45,
  },
  {
    name: 'Monitor Samsung 27" 4K',
    price: 1299.5,
    stock: 22,
  },
  {
    name: "Mysz bezprzewodowa Razer",
    price: 249.99,
    stock: 67,
  },
  {
    name: "Słuchawki Sony WH-1000XM5",
    price: 1499.0,
    stock: 30,
  },
  {
    name: "Dysk SSD Samsung 1TB",
    price: 449.0,
    stock: 120,
  },
  {
    name: "Webcam Logitech HD",
    price: 299.99,
    stock: 55,
  },
  {
    name: "Stacja dokująca USB-C",
    price: 799.0,
    stock: 18,
  },
  {
    name: "Powerbank Anker 20000mAh",
    price: 179.99,
    stock: 85,
  },
  {
    name: "Adapter HDMI-USB-C",
    price: 89.99,
    stock: 150,
  },
];

// Adres API Gateway - domyślnie localhost, można nadpisać zmienną środowiskową
const BASE_URL = __ENV.API_GATEWAY_URL || "http://distributed.local";
const PRODUCT_ENDPOINT = `${BASE_URL}/api/product`;

export default function () {
  console.log(
    "🚀 Rozpoczynam dodawanie 10 testowych produktów do ProductService...\n"
  );

  let successCount = 0;
  let failureCount = 0;

  // Iterujemy przez każdy produkt i wysyłamy zapytanie POST
  testProducts.forEach((product, index) => {
    console.log(`📦 [${index + 1}/10] Dodawanie produktu: ${product.name}`);

    // Przygotowanie payload JSON
    const payload = JSON.stringify({
      name: product.name,
      price: product.price,
      stock: product.stock,
    });

    // Parametry zapytania HTTP
    const params = {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: "10s", // Timeout dla pojedynczego requesta
    };

    // Wysłanie zapytania POST do utworzenia produktu
    const response = http.post(PRODUCT_ENDPOINT, payload, params);

    // Walidacja odpowiedzi
    const checkResult = check(response, {
      "Status jest 201 Created": (r) => r.status === 201,
      "Odpowiedź zawiera ID produktu": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.id !== undefined && body.id !== null;
        } catch (e) {
          return false;
        }
      },
      "Produkt ma poprawną nazwę": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.name === product.name;
        } catch (e) {
          return false;
        }
      },
      "Produkt ma poprawną cenę": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.price === product.price;
        } catch (e) {
          return false;
        }
      },
    });

    // Logowanie wyniku
    if (response.status === 201) {
      successCount++;
      const responseBody = JSON.parse(response.body);
      console.log(`   ✅ Sukces! ID: ${responseBody.id}`);
      console.log(
        `   📊 Cena: ${responseBody.price} PLN, Zapas: ${responseBody.stock} szt.\n`
      );
    } else {
      failureCount++;
      console.log(`   ❌ Błąd! Status: ${response.status}`);
      console.log(`   📄 Odpowiedź: ${response.body}\n`);
    }

    // Krótkie opóźnienie między requestami, żeby nie przeciążyć systemu
    sleep(0.5);
  });

  // Podsumowanie
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 PODSUMOWANIE SEEDOWANIA PRODUKTÓW");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ Produkty dodane pomyślnie: ${successCount}/10`);
  console.log(`❌ Błędy: ${failureCount}/10`);
  console.log(
    `🎯 Wskaźnik sukcesu: ${((successCount / 10) * 100).toFixed(1)}%`
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Opcjonalnie: weryfikacja poprzez pobranie wszystkich produktów
  console.log("🔍 Weryfikuję dodane produkty...");
  const getAllResponse = http.get(PRODUCT_ENDPOINT);

  if (getAllResponse.status === 200) {
    const allProducts = JSON.parse(getAllResponse.body);
    console.log(
      `✅ Potwierdzenie: w bazie znajduje się ${allProducts.length} produktów\n`
    );

    // Wyświetl listę wszystkich produktów
    console.log("📋 Lista produktów w bazie:");
    allProducts.forEach((p, idx) => {
      console.log(
        `   ${idx + 1}. ${p.name} - ${p.price} PLN (${p.stock} szt.)`
      );
    });
  } else {
    console.log(
      `⚠️ Nie udało się pobrać listy produktów. Status: ${getAllResponse.status}`
    );
  }
}
