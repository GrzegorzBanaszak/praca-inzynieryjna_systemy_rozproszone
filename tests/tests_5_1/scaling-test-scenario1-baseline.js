import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Custom metrics for detailed analysis
const successRate = new Rate("success_rate");
const requestDuration = new Trend("request_duration");
const failureCounter = new Counter("failures");

export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Warm-up: ramp up to 10 VU
    // { duration: "1m", target: 50 }, // Gradual increase to 50 VU
    // { duration: "2m", target: 100 }, // Increase to 100 VU
    // { duration: "2m", target: 150 }, // Increase to 150 VU
    // { duration: "2m", target: 200 }, // Maximum load: 200 VU
    // { duration: "1m", target: 200 }, // Sustain peak load
    // { duration: "2m", target: 0 }, // Cool down: gradual decrease
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"], // 95% < 500ms, 99% < 1s
    http_req_failed: ["rate<0.01"], // Less than 1% errors
    success_rate: ["rate>0.99"], // More than 99% success
  },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  noConnectionReuse: false,
};

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

const SCENARIO = "baseline";
const BASE_URL = __ENV.BASE_URL || "http://distributed.local";
const PRODUCT_ENDPOINT = `${BASE_URL}/api/product`;

function add_products() {
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

export function setup() {
  const respons = http.get(PRODUCT_ENDPOINT);

  const data = JSON.parse(respons.body);
  if (data.length === 0) {
    add_products();
  }

  sleep(1);
}

export default function () {
  // Test the GET /api/product endpoint (retrieve all products)
  const url = `${BASE_URL}/api/product`;

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
    tags: {
      scenario: "baseline",
      name: "get_products",
    },
  };

  const response = http.get(url, params);

  // Detailed checks
  const checksOk = check(response, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
    "response time < 1000ms": (r) => r.timings.duration < 1000,
    "response body is not empty": (r) => r.body && r.body.length > 0,
    "content-type is JSON": (r) =>
      r.headers["Content-Type"]?.includes("application/json"),
  });

  // Record custom metrics
  successRate.add(checksOk);
  requestDuration.add(response.timings.duration);

  if (!checksOk) {
    failureCounter.add(1);
    console.error(
      `Request failed at VU ${__VU}, iteration ${__ITER}: ${
        response.status
      } - ${response.error || "Unknown error"}`
    );
  }

  // Simulate realistic user behavior with 1 second pause between requests
  sleep(1);
}

// Custom summary handler to generate detailed JSON report
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `results/scenario1-baseline-${timestamp}.json`;

  return {
    [filename]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: "  ", enableColors: true }),
  };
}

function textSummary(data, { indent = "", enableColors = false } = {}) {
  const colors = enableColors
    ? {
        reset: "\x1b[0m",
        green: "\x1b[32m",
        red: "\x1b[31m",
        yellow: "\x1b[33m",
        cyan: "\x1b[36m",
      }
    : {
        reset: "",
        green: "",
        red: "",
        yellow: "",
        cyan: "",
      };

  let summary = `\n${indent}${colors.cyan}╔═══════════════════════════════════════════════════════════╗${colors.reset}\n`;
  summary += `${indent}${colors.cyan}║  📊 Scaling Test - Scenario 1: Baseline Performance      ║${colors.reset}\n`;
  summary += `${indent}${colors.cyan}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n\n`;

  // HTTP metrics with null safety
  const httpReqs = data.metrics.http_reqs;
  const httpReqDuration = data.metrics.http_req_duration;
  const httpReqFailed = data.metrics.http_req_failed;

  // Helper function to safely format numbers
  const formatValue = (value, suffix = "") => {
    return value !== undefined && value !== null
      ? `${value.toFixed(2)}${suffix}`
      : "N/A";
  };

  summary += `${indent}${colors.yellow}📈 Request Statistics:${colors.reset}\n`;
  summary += `${indent}  Total Requests: ${httpReqs?.values?.count || 0}\n`;
  summary += `${indent}  Requests/sec: ${formatValue(
    httpReqs?.values?.rate
  )}\n`;
  summary += `${indent}  Failed Requests: ${formatValue(
    (httpReqFailed?.values?.rate || 0) * 100,
    "%"
  )}\n\n`;

  if (httpReqDuration?.values) {
    summary += `${indent}${colors.yellow}⏱️  Response Time Percentiles:${colors.reset}\n`;
    summary += `${indent}  P50 (median): ${formatValue(
      httpReqDuration.values["p(50)"],
      "ms"
    )}\n`;
    summary += `${indent}  P90: ${formatValue(
      httpReqDuration.values["p(90)"],
      "ms"
    )}\n`;
    summary += `${indent}  P95: ${formatValue(
      httpReqDuration.values["p(95)"],
      "ms"
    )}\n`;
    summary += `${indent}  P99: ${formatValue(
      httpReqDuration.values["p(99)"],
      "ms"
    )}\n`;
    summary += `${indent}  Average: ${formatValue(
      httpReqDuration.values.avg,
      "ms"
    )}\n`;
    summary += `${indent}  Max: ${formatValue(
      httpReqDuration.values.max,
      "ms"
    )}\n\n`;
  } else {
    summary += `${indent}${colors.yellow}⏱️  Response Time Percentiles:${colors.reset}\n`;
    summary += `${indent}  No duration metrics available\n\n`;
  }

  // Threshold checks
  summary += `${indent}${colors.yellow}✅ Threshold Results:${colors.reset}\n`;
  const thresholds = data.root_group?.checks || [];
  if (thresholds.length > 0) {
    for (const check of thresholds) {
      const passes = check.passes || 0;
      const fails = check.fails || 0;
      const total = passes + fails;
      const status =
        fails === 0 && total > 0 ? colors.green + "✓" : colors.red + "✗";
      summary += `${indent}  ${status} ${check.name || "Unknown check"}${
        colors.reset
      }\n`;
    }
  } else {
    summary += `${indent}  No threshold checks available\n`;
  }

  return summary;
}
