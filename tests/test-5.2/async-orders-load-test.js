// async-orders-load-test.js
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend, Rate } from "k6/metrics";
import {
  randomString,
  randomIntBetween,
} from "https://jslib.k6.io/k6-utils/1.2.0/index.js";

// ============================================================================
// KONFIGURACJA
// ============================================================================

const BASE_URL = __ENV.BASE_URL || "http://distributed.local";
const TEST_USERS_COUNT = parseInt(__ENV.TEST_USERS || "10");
const VUS = parseInt(__ENV.VUS || "50");
const DURATION = __ENV.DURATION || "20s";

// ============================================================================
// CUSTOM METRICS
// ============================================================================

const orderCreationTime = new Trend("order_creation_time", true);
const orderCreationRate = new Rate("order_creation_success_rate");
const orderCounter = new Counter("orders_created_total");
const authFailures = new Counter("auth_failures");
const orderFailures = new Counter("order_failures");
const http201Counter = new Counter("http_201_responses");
const http401Counter = new Counter("http_401_responses");
const http500Counter = new Counter("http_500_responses");

// ============================================================================
// OPCJE TESTU
// ============================================================================

export const options = {
  scenarios: {
    async_order_creation: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: VUS },
        { duration: DURATION, target: VUS },
        { duration: "10s", target: 0 },
      ],
      gracefulRampDown: "5s",
    },
  },

  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    order_creation_time: ["p(95)<600", "p(99)<1200"],
    order_creation_success_rate: ["rate>0.95"],
    http_req_failed: ["rate<0.05"],
    http_reqs: ["rate>50"],
    auth_failures: ["count<10"],
  },

  discardResponseBodies: false,
  summaryTrendStats: ["min", "avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

// ============================================================================
// FUNKCJE POMOCNICZE
// ============================================================================

/**
 * Rejestracja nowego użytkownika
 */
function registerUser(username, password) {
  const payload = JSON.stringify({
    username: username,
    password: password,
  });

  const params = {
    headers: { "Content-Type": "application/json" },
    tags: { name: "Register" },
    timeout: "30s",
  };

  console.log(`Attempting to register user: ${username}`);
  const response = http.post(`${BASE_URL}/api/user/register`, payload, params);

  console.log(
    `Register response - Status: ${
      response.status
    }, Body: ${response.body.substring(0, 200)}`
  );

  const success = check(response, {
    "registration status is 200 or 400": (r) =>
      r.status === 200 || r.status === 400,
  });

  if (!success) {
    console.error(
      `Registration failed for ${username}: Status ${response.status}, Body: ${response.body}`
    );
  }

  return success;
}

/**
 * Logowanie użytkownika
 */
function loginUser(username, password) {
  const payload = JSON.stringify({
    username: username,
    password: password,
  });

  const params = {
    headers: { "Content-Type": "application/json" },
    tags: { name: "Login" },
    timeout: "30s",
  };

  console.log(`Attempting to login user: ${username}`);
  const response = http.post(`${BASE_URL}/api/user/login`, payload, params);

  console.log(
    `Login response - Status: ${
      response.status
    }, Body: ${response.body.substring(0, 200)}`
  );

  if (response.status !== 200) {
    console.error(
      `Login failed for ${username}: Status ${response.status}, Body: ${response.body}`
    );
    authFailures.add(1);
    return null;
  }

  let token = null;
  try {
    const jsonBody = response.json();
    token = jsonBody.token || jsonBody.Token;
  } catch (e) {
    console.error(
      `Failed to parse login response for ${username}: ${e.message}`
    );
  }

  if (!token) {
    console.error(`No token in login response for ${username}`);
    authFailures.add(1);
    return null;
  }

  console.log(
    `Successfully logged in ${username}, token starts with: ${token.substring(
      0,
      20
    )}...`
  );
  return token;
}

/**
 * Pobranie produktów
 */
function getProducts() {
  const params = {
    headers: { "Content-Type": "application/json" },
    tags: { name: "GetProducts" },
    timeout: "30s",
  };

  console.log("Fetching products...");
  const response = http.get(`${BASE_URL}/api/product`, params);

  console.log(`Get products response - Status: ${response.status}`);

  if (response.status === 200) {
    try {
      const products = response.json();
      if (Array.isArray(products)) {
        const ids = products.map((p) => p.id || p.Id).filter((id) => id);
        console.log(`Found ${ids.length} products`);
        return ids;
      }
    } catch (e) {
      console.error(`Failed to parse products: ${e.message}`);
    }
  }

  return [];
}

/**
 * Utworzenie produktu
 */
function createSampleProduct(token, name) {
  const payload = JSON.stringify({
    name: name,
    price: randomIntBetween(10, 1000),
    stock: randomIntBetween(10, 100),
  });

  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    tags: { name: "CreateProduct" },
    timeout: "30s",
  };

  console.log(`Creating product: ${name}`);
  const response = http.post(`${BASE_URL}/api/product`, payload, params);

  console.log(`Create product response - Status: ${response.status}`);

  if (response.status === 201 || response.status === 200) {
    try {
      const product = response.json();
      const productId = product.id || product.Id;
      console.log(`Product created with ID: ${productId}`);
      return productId;
    } catch (e) {
      console.error(`Failed to parse product response: ${e.message}`);
    }
  }

  return null;
}

/**
 * Złożenie zamówienia
 */
function createOrder(token, productId) {
  const payload = JSON.stringify({
    productId: productId,
    quantity: randomIntBetween(1, 5),
  });

  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    tags: { name: "CreateOrder" },
    timeout: "10s",
  };

  const startTime = new Date().getTime();
  const response = http.post(`${BASE_URL}/api/order`, payload, params);
  const duration = new Date().getTime() - startTime;

  orderCreationTime.add(duration);

  const success = check(response, {
    "order creation status is 201": (r) => r.status === 201,
    "order has ID": (r) => {
      if (r.status === 201 && r.body) {
        try {
          const order = r.json();
          return order.id !== undefined || order.Id !== undefined;
        } catch (e) {
          return false;
        }
      }
      return false;
    },
    "response time < 1000ms": (r) => r.timings.duration < 1000,
  });

  if (response.status === 201) {
    http201Counter.add(1);
    orderCounter.add(1);
    orderCreationRate.add(true);
  } else {
    orderCreationRate.add(false);
    orderFailures.add(1);

    if (response.status === 401) {
      http401Counter.add(1);
      authFailures.add(1);
    } else if (response.status >= 500) {
      http500Counter.add(1);
    }
  }

  return { success, response };
}

// ============================================================================
// SETUP
// ============================================================================

export function setup() {
  console.log("=".repeat(80));
  console.log("=== SETUP: Preparing test data ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Users: ${TEST_USERS_COUNT}`);
  console.log("=".repeat(80));

  const testUsers = [];
  const productIds = [];

  // Test connectivity
  console.log("\n1. Testing connectivity...");
  const healthCheck = http.get(`${BASE_URL}/api/product`, { timeout: "10s" });
  console.log(`Health check status: ${healthCheck.status}`);

  if (healthCheck.status === 0) {
    console.error(`FATAL: Cannot connect to ${BASE_URL}`);
    console.error("Please check:");
    console.error("1. Is minikube tunnel running?");
    console.error("2. Is the ingress configured correctly?");
    console.error("3. Try: curl http://distributed.local/api/product");
    throw new Error("Cannot connect to API");
  }

  // Rejestracja użytkowników
  console.log(`\n2. Creating ${TEST_USERS_COUNT} test users...`);
  for (let i = 0; i < TEST_USERS_COUNT; i++) {
    const timestamp = Date.now();
    const random = randomString(6);
    const username = `testuser_${timestamp}_${random}`;
    const password = "TestPass123!";

    console.log(
      `\n  [${i + 1}/${TEST_USERS_COUNT}] Processing user: ${username}`
    );

    // Rejestracja
    const registered = registerUser(username, password);

    if (!registered) {
      console.warn(`  ⚠️  Failed to register ${username}, skipping...`);
      continue;
    }

    // Poczekaj chwilę między rejestracją a logowaniem
    sleep(0.5);

    // Logowanie
    const token = loginUser(username, password);

    if (token) {
      testUsers.push({ username, password, token });
      console.log(`  ✅ User ${username} ready`);
    } else {
      console.warn(`  ⚠️  Failed to login ${username}`);
    }

    // Nie przeciążaj systemu podczas setup
    sleep(0.5);
  }

  console.log(
    `\n✅ Successfully created ${testUsers.length}/${TEST_USERS_COUNT} users`
  );

  if (testUsers.length === 0) {
    console.error("\nFATAL: No users were created successfully!");
    console.error("Please check the application logs and ensure:");
    console.error("1. UserService is running");
    console.error("2. PostgreSQL (UserDb) is accessible");
    console.error("3. API routes are correct");
    throw new Error("No test users available");
  }

  // Utworzenie produktów
  console.log("\n3. Creating sample products...");
  const adminToken = testUsers[0].token;

  // Najpierw sprawdź czy są jakieś produkty
  const existingProducts = getProducts();

  if (existingProducts.length > 0) {
    console.log(`Found ${existingProducts.length} existing products`);
    productIds.push(...existingProducts);
  }

  // Jeśli jest mniej niż 5 produktów, dodaj więcej
  const productsToCreate = Math.max(0, 10 - existingProducts.length);

  if (productsToCreate > 0) {
    console.log(`Creating ${productsToCreate} additional products...`);

    for (let i = 0; i < productsToCreate; i++) {
      const productName = `TestProduct-${Date.now()}-${randomString(6)}`;
      const productId = createSampleProduct(adminToken, productName);

      if (productId) {
        productIds.push(productId);
        console.log(`  ✅ Product ${i + 1}/${productsToCreate} created`);
      } else {
        console.warn(`  ⚠️  Failed to create product ${i + 1}`);
      }

      sleep(0.3);
    }
  }

  console.log(`\n✅ Total products available: ${productIds.length}`);

  if (productIds.length === 0) {
    console.error("\nFATAL: No products available!");
    console.error("Please check:");
    console.error("1. ProductService is running");
    console.error("2. MongoDB is accessible");
    throw new Error("No products available");
  }

  console.log("\n" + "=".repeat(80));
  console.log("=== SETUP COMPLETE ===");
  console.log(`Users ready: ${testUsers.length}`);
  console.log(`Products ready: ${productIds.length}`);
  console.log("=".repeat(80) + "\n");

  return {
    users: testUsers,
    products: productIds,
    testStartTime: new Date().getTime(),
  };
}

// ============================================================================
// GŁÓWNY SCENARIUSZ
// ============================================================================

export default function (data) {
  if (!data || !data.users || data.users.length === 0) {
    console.error("No test data available");
    sleep(5);
    return;
  }

  if (!data.products || data.products.length === 0) {
    console.error("No products available");
    sleep(5);
    return;
  }

  // Wybierz losowego użytkownika i produkt
  const user = data.users[Math.floor(Math.random() * data.users.length)];
  const productId =
    data.products[Math.floor(Math.random() * data.products.length)];

  if (!user || !user.token) {
    console.error("Invalid user data");
    sleep(1);
    return;
  }

  // Złóż zamówienie
  const { success, response } = createOrder(user.token, productId);

  if (!success) {
    console.error(`Order creation failed: Status ${response.status}`);
  }

  // Think time
  sleep(randomIntBetween(1, 3));

  // Czasem sprawdź swoje zamówienia (20% szans)
  if (Math.random() < 0.2) {
    const params = {
      headers: {
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "application/json",
      },
      tags: { name: "GetMyOrders" },
      timeout: "10s",
    };

    http.get(`${BASE_URL}/api/order`, params);
  }
}

// ============================================================================
// TEARDOWN
// ============================================================================

export function teardown(data) {
  const duration = (new Date().getTime() - data.testStartTime) / 1000;

  console.log("\n" + "=".repeat(80));
  console.log("=== TEST SUMMARY ===");
  console.log(`Test duration: ${duration.toFixed(2)}s`);
  console.log(`Total users: ${data.users.length}`);
  console.log(`Total products: ${data.products.length}`);
  console.log("=".repeat(80));
}

// ============================================================================
// SUMMARY HANDLER
// ============================================================================

export function handleSummary(data) {
  const summary = {
    testInfo: {
      startTime: new Date(data.state.testRunDurationMs).toISOString(),
      duration: `${(data.state.testRunDurationMs / 1000).toFixed(2)}s`,
      vus: VUS,
    },
    httpMetrics: {
      totalRequests: data.metrics.http_reqs?.values?.count || 0,
      requestRate: data.metrics.http_reqs?.values?.rate?.toFixed(2) || 0,
      failedRequests:
        (data.metrics.http_req_failed?.values?.rate * 100)?.toFixed(2) || 0,
      avgDuration: data.metrics.http_req_duration?.values?.avg?.toFixed(2) || 0,
      p95Duration:
        data.metrics.http_req_duration?.values["p(95)"]?.toFixed(2) || 0,
      p99Duration:
        data.metrics.http_req_duration?.values["p(99)"]?.toFixed(2) || 0,
    },
    orderMetrics: {
      totalOrders: data.metrics.orders_created_total?.values?.count || 0,
      successRate:
        (data.metrics.order_creation_success_rate?.values?.rate * 100)?.toFixed(
          2
        ) || 0,
      avgCreationTime:
        data.metrics.order_creation_time?.values?.avg?.toFixed(2) || 0,
      p95CreationTime:
        data.metrics.order_creation_time?.values["p(95)"]?.toFixed(2) || 0,
      p99CreationTime:
        data.metrics.order_creation_time?.values["p(99)"]?.toFixed(2) || 0,
    },
    errors: {
      authFailures: data.metrics.auth_failures?.values?.count || 0,
      orderFailures: data.metrics.order_failures?.values?.count || 0,
      http401: data.metrics.http_401_responses?.values?.count || 0,
      http500: data.metrics.http_500_responses?.values?.count || 0,
    },
  };

  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "summary.json": JSON.stringify(summary, null, 2),
  };
}

function textSummary(data, options) {
  return "";
}
