import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

// ============================================================================
// KONFIGURACJA
// ============================================================================

const BASE_URL = __ENV.BASE_URL || "http://distributed.local";
const SCENARIO = __ENV.SCENARIO || "large"; // small, medium, large

// Metryki niestandardowe
const registrationErrors = new Counter("registration_errors");
const loginErrors = new Counter("login_errors");
const productListErrors = new Counter("product_list_errors");
const orderErrors = new Counter("order_errors");
const registrationDuration = new Trend("registration_duration");
const loginDuration = new Trend("login_duration");
const productListDuration = new Trend("product_list_duration");
const orderDuration = new Trend("order_duration");
const endToEndDuration = new Trend("end_to_end_duration");

// ============================================================================
// SCENARIUSZE OBCIĄŻENIA
// ============================================================================

const scenarios = {
  small: {
    executor: "ramping-vus",
    startVUs: 1,
    stages: [
      { duration: "1m", target: 5 }, // Rozgrzewka do 5 VU
      { duration: "3m", target: 5 }, // Utrzymanie 5 VU
      { duration: "1m", target: 10 }, // Zwiększenie do 10 VU
      { duration: "3m", target: 10 }, // Utrzymanie 10 VU
      { duration: "1m", target: 0 }, // Schładzanie
    ],
    gracefulRampDown: "30s",
  },
  medium: {
    executor: "ramping-vus",
    startVUs: 5,
    stages: [
      { duration: "2m", target: 20 }, // Rozgrzewka do 20 VU
      { duration: "5m", target: 20 }, // Utrzymanie 20 VU
      { duration: "2m", target: 40 }, // Zwiększenie do 40 VU
      { duration: "5m", target: 40 }, // Utrzymanie 40 VU
      { duration: "1m", target: 0 }, // Schładzanie
    ],
    gracefulRampDown: "30s",
  },
  large: {
    executor: "ramping-vus",
    startVUs: 10,
    stages: [
      { duration: "2m", target: 50 }, // Rozgrzewka do 50 VU
      { duration: "5m", target: 50 }, // Utrzymanie 50 VU
      { duration: "2m", target: 80 }, // Zwiększenie do 80 VU
      { duration: "5m", target: 80 }, // Utrzymanie 80 VU
      { duration: "2m", target: 100 }, // Szczyt - 100 VU
      { duration: "3m", target: 100 }, // Utrzymanie szczytu
      { duration: "2m", target: 0 }, // Schładzanie
    ],
    gracefulRampDown: "30s",
  },
};

export const options = {
  scenarios: {
    user_journey: scenarios[SCENARIO],
  },
  thresholds: {
    http_req_duration: ["p(95)<1000", "p(99)<2000"], // 95% < 1s, 99% < 2s
    http_req_failed: ["rate<0.05"], // Błędy < 5%
    "http_req_duration{name:registration}": ["p(95)<500"],
    "http_req_duration{name:login}": ["p(95)<500"],
    "http_req_duration{name:product_list}": ["p(95)<800"],
    "http_req_duration{name:create_order}": ["p(95)<1500"],
  },
  summaryTrendStats: ["min", "avg", "med", "max", "p(90)", "p(95)", "p(99)"],
};

// ============================================================================
// SETUP - Przygotowanie środowiska testowego
// ============================================================================

export function setup() {
  console.log(`🚀 Uruchamianie testu - Scenariusz: ${SCENARIO}`);
  console.log(`📊 Konfiguracja: ${JSON.stringify(scenarios[SCENARIO].stages)}`);

  // Sprawdź czy system jest dostępny
  const healthCheck = http.get(`${BASE_URL}/api/product/healthz`);
  if (healthCheck.status !== 200) {
    console.error("❌ System niedostępny! Health check failed.");
    return { productsExist: false, products: [] };
  }
  console.log("✅ System dostępny - health check passed");

  // Sprawdź czy istnieją produkty
  const productsResponse = http.get(`${BASE_URL}/api/product`);
  let products = [];

  if (productsResponse.status === 200) {
    try {
      products = JSON.parse(productsResponse.body);
      console.log(`📦 Znaleziono ${products.length} produktów w bazie`);
    } catch (e) {
      console.warn("⚠️  Błąd parsowania listy produktów:", e);
    }
  }

  // Jeśli brak produktów - dodaj testowe
  if (!products || products.length === 0) {
    console.log("🔨 Brak produktów - dodawanie testowych...");

    const testProducts = [
      { name: "Laptop HP ProBook", price: 2999.99, stock: 50 },
      { name: 'Monitor Dell 27"', price: 1299.99, stock: 100 },
      { name: "Klawiatura Logitech", price: 299.99, stock: 200 },
      { name: "Mysz Razer", price: 249.99, stock: 150 },
      { name: "Słuchawki Sony WH-1000XM5", price: 1499.99, stock: 75 },
      { name: "Kamera Logitech C920", price: 449.99, stock: 120 },
      { name: "Dysk SSD Samsung 1TB", price: 599.99, stock: 180 },
      { name: "Pendrive 128GB", price: 89.99, stock: 300 },
    ];

    products = [];
    for (const product of testProducts) {
      const response = http.post(
        `${BASE_URL}/api/product`,
        JSON.stringify(product),
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.status === 201) {
        try {
          const created = JSON.parse(response.body);
          products.push(created);
          console.log(`  ✓ Dodano: ${product.name} (ID: ${created.id})`);
        } catch (e) {
          console.warn(`  ⚠️  Błąd parsowania odpowiedzi dla ${product.name}`);
        }
      } else {
        console.warn(
          `  ⚠️  Nie udało się dodać ${product.name}: ${response.status}`
        );
      }
      sleep(0.1); // Małe opóźnienie między dodawaniem
    }

    console.log(`✅ Dodano ${products.length} produktów testowych`);
  }

  return {
    productsExist: products.length > 0,
    products: products,
    startTime: new Date().toISOString(),
    scenario: SCENARIO,
  };
}

// ============================================================================
// GŁÓWNY SCENARIUSZ TESTOWY
// ============================================================================

export default function (data) {
  if (!data.productsExist || data.products.length === 0) {
    console.error("❌ Brak produktów - test nie może być kontynuowany");
    return;
  }

  const startTime = new Date().getTime();
  const username = `user_${__VU}_${__ITER}_${Date.now()}`;
  const password = "TestPassword123!";
  let token = null;

  // ========================================================================
  // KROK 1: REJESTRACJA
  // ========================================================================
  const regStart = new Date().getTime();
  const registerResponse = http.post(
    `${BASE_URL}/api/user/register`,
    JSON.stringify({
      username: username,
      password: password,
    }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "registration" },
    }
  );

  const regDuration = new Date().getTime() - regStart;
  registrationDuration.add(regDuration);

  const regSuccess = check(registerResponse, {
    "rejestracja: status 200": (r) => r.status === 200,
    "rejestracja: czas < 1s": (r) => r.timings.duration < 1000,
  });

  if (!regSuccess) {
    registrationErrors.add(1);
    console.warn(
      `❌ Rejestracja nieudana dla ${username}: status ${registerResponse.status}`
    );
    return; // Przerwij iterację
  }

  sleep(1); // Think time - użytkownik czyta informacje

  // ========================================================================
  // KROK 2: LOGOWANIE
  // ========================================================================
  const loginStart = new Date().getTime();
  const loginResponse = http.post(
    `${BASE_URL}/api/user/login`,
    JSON.stringify({
      username: username,
      password: password,
    }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "login" },
    }
  );

  const loginDur = new Date().getTime() - loginStart;
  loginDuration.add(loginDur);

  const loginSuccess = check(loginResponse, {
    "logowanie: status 200": (r) => r.status === 200,
    "logowanie: otrzymano token": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token && body.token.length > 0;
      } catch {
        return false;
      }
    },
    "logowanie: czas < 800ms": (r) => r.timings.duration < 800,
  });

  if (!loginSuccess) {
    loginErrors.add(1);
    console.warn(
      `❌ Logowanie nieudane dla ${username}: status ${loginResponse.status}`
    );
    return;
  }

  // Wyciągnij token JWT
  try {
    const loginBody = JSON.parse(loginResponse.body);
    token = loginBody.token;
  } catch (e) {
    console.error("❌ Nie można sparsować tokenu JWT");
    return;
  }

  sleep(2); // Think time - użytkownik przegląda stronę

  // ========================================================================
  // KROK 3: POBRANIE LISTY PRODUKTÓW
  // ========================================================================
  const productListStart = new Date().getTime();
  const productsResponse = http.get(`${BASE_URL}/api/product`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    tags: { name: "product_list" },
  });

  const prodListDur = new Date().getTime() - productListStart;
  productListDuration.add(prodListDur);

  const productsSuccess = check(productsResponse, {
    "lista produktów: status 200": (r) => r.status === 200,
    "lista produktów: nie jest pusta": (r) => {
      try {
        const products = JSON.parse(r.body);
        return Array.isArray(products) && products.length > 0;
      } catch {
        return false;
      }
    },
    "lista produktów: czas < 1s": (r) => r.timings.duration < 1000,
  });

  if (!productsSuccess) {
    productListErrors.add(1);
    console.warn(
      `❌ Pobranie listy produktów nieudane: status ${productsResponse.status}`
    );
    return;
  }

  // Parsuj produkty
  let availableProducts = [];
  try {
    availableProducts = JSON.parse(productsResponse.body);
  } catch (e) {
    console.error("❌ Nie można sparsować listy produktów");
    return;
  }

  sleep(3); // Think time - użytkownik przegląda produkty

  // ========================================================================
  // KROK 4: WYBÓR PRODUKTU I ZŁOŻENIE ZAMÓWIENIA
  // ========================================================================

  // Wybierz losowy produkt z dostępnych
  const selectedProduct =
    availableProducts[Math.floor(Math.random() * availableProducts.length)];
  const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 sztuki

  const orderStart = new Date().getTime();
  const orderResponse = http.post(
    `${BASE_URL}/api/order`,
    JSON.stringify({
      productId: selectedProduct.id,
      quantity: quantity,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      tags: { name: "create_order" },
    }
  );

  const orderDur = new Date().getTime() - orderStart;
  orderDuration.add(orderDur);

  const orderSuccess = check(orderResponse, {
    "zamówienie: status 201": (r) => r.status === 201,
    "zamówienie: zawiera ID": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id && body.id.length > 0;
      } catch {
        return false;
      }
    },
    "zamówienie: czas < 2s": (r) => r.timings.duration < 2000,
  });

  if (!orderSuccess) {
    orderErrors.add(1);
    console.warn(
      `❌ Złożenie zamówienia nieudane: status ${orderResponse.status}, ` +
        `produkt: ${selectedProduct.name}`
    );
  }

  // Zmierz całkowity czas end-to-end
  const totalDuration = new Date().getTime() - startTime;
  endToEndDuration.add(totalDuration);

  sleep(1); // Think time przed następną iteracją
}

// ============================================================================
// TEARDOWN - Podsumowanie i zapis wyników
// ============================================================================

export function teardown(data) {
  console.log("🏁 Test zakończony");
  console.log(`⏱️  Czas rozpoczęcia: ${data.startTime}`);
  console.log(`⏱️  Czas zakończenia: ${new Date().toISOString()}`);
}

// ============================================================================
// EKSPORT WYNIKÓW DO JSON
// ============================================================================

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `test-variant-large-results-${SCENARIO}-${timestamp}.json`;

  // Przygotuj szczegółowe podsumowanie
  const summary = {
    timestamp: new Date().toISOString(),
    scenario: SCENARIO,
    configuration: scenarios[SCENARIO],
    metrics: {
      http_reqs: data.metrics.http_reqs,
      http_req_duration: data.metrics.http_req_duration,
      http_req_failed: data.metrics.http_req_failed,
      registration_duration: data.metrics.registration_duration,
      login_duration: data.metrics.login_duration,
      product_list_duration: data.metrics.product_list_duration,
      order_duration: data.metrics.order_duration,
      end_to_end_duration: data.metrics.end_to_end_duration,
      registration_errors: data.metrics.registration_errors,
      login_errors: data.metrics.login_errors,
      product_list_errors: data.metrics.product_list_errors,
      order_errors: data.metrics.order_errors,
    },
    thresholds: data.metrics.checks,
  };

  console.log("\n" + "=".repeat(80));
  console.log("📊 PODSUMOWANIE TESTU");
  console.log("=".repeat(80));
  console.log(`Scenariusz: ${SCENARIO}`);
  console.log(`Całkowite żądania: ${data.metrics.http_reqs.values.count}`);
  console.log(
    `Średni czas odpowiedzi: ${data.metrics.http_req_duration.values.avg.toFixed(
      2
    )}ms`
  );
  console.log(
    `P95 czas odpowiedzi: ${data.metrics.http_req_duration.values[
      "p(95)"
    ].toFixed(2)}ms`
  );
  console.log(
    `P99 czas odpowiedzi: ${data.metrics.http_req_duration.values[
      "p(99)"
    ].toFixed(2)}ms`
  );
  console.log(
    `Wskaźnik błędów: ${(
      data.metrics.http_req_failed.values.rate * 100
    ).toFixed(2)}%`
  );
  console.log("=".repeat(80) + "\n");

  // Zwróć dane do zapisu w plikach
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    [`results/${filename}`]: JSON.stringify(summary, null, 2),
  };
}
