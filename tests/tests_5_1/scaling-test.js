import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// Custom metrics for detailed analysis
const successRate = new Rate("success_rate");
const requestDuration = new Trend("request_duration");
const failureCounter = new Counter("failures");

// Configuration for different test phases
export const options = {
  stages: [
    { duration: "1m", target: 10 }, // Warm-up: ramp up to 10 VU
    { duration: "2m", target: 50 }, // Gradual increase to 50 VU
    { duration: "2m", target: 100 }, // Increase to 100 VU
    { duration: "2m", target: 150 }, // Increase to 150 VU
    { duration: "2m", target: 200 }, // Maximum load: 200 VU
    { duration: "2m", target: 200 }, // Sustain peak load
    { duration: "2m", target: 0 }, // Cool down: gradual decrease
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

// Get scenario from environment variable
const SCENARIO = __ENV.SCALING_SCENARIO || "HPA";
const BASE_URL = __ENV.BASE_URL || "http://distributed.local";
const PRODUCT_ENDPOINT = `${BASE_URL}/api/product`;

function add_products() {
  console.log(
    "🚀 Rozpoczynam dodawanie 10 testowych produktów do ProductService...\n"
  );

  let successCount = 0;
  let failureCount = 0;

  testProducts.forEach((product, index) => {
    console.log(`📦 [${index + 1}/10] Dodawanie produktu: ${product.name}`);

    const payload = JSON.stringify({
      name: product.name,
      price: product.price,
      stock: product.stock,
    });

    const params = {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: "10s",
    };

    const response = http.post(PRODUCT_ENDPOINT, payload, params);

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
    });

    if (response.status === 201) {
      successCount++;
      const responseBody = JSON.parse(response.body);
      console.log(`   ✅ Sukces! ID: ${responseBody.id}`);
    } else {
      failureCount++;
      console.log(`   ❌ Błąd! Status: ${response.status}`);
    }

    sleep(0.5);
  });

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 PODSUMOWANIE SEEDOWANIA PRODUKTÓW");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ Produkty dodane pomyślnie: ${successCount}/10`);
  console.log(`❌ Błędy: ${failureCount}/10`);
  console.log(
    `🎯 Wskaźnik sukcesu: ${((successCount / 10) * 100).toFixed(1)}%`
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

export function setup() {
  console.log(
    `\n🔬 Rozpoczynam test skalowania dla scenariusza: ${SCENARIO}\n`
  );

  const response = http.get(PRODUCT_ENDPOINT);
  const data = JSON.parse(response.body);

  if (data.length === 0) {
    add_products();
  }

  sleep(1);

  return {
    scenario: SCENARIO,
    startTime: new Date().toISOString(),
  };
}

export default function (data) {
  const url = `${BASE_URL}/api/product`;

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
    tags: {
      scenario: SCENARIO,
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

  sleep(1);
}

export function teardown(data) {
  console.log(`\n✅ Test zakończony dla scenariusza: ${data.scenario}`);
}

// Enhanced summary handler with JSON export
export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const scenarioType = __ENV.SCALING_SCENARIO || "HPA";

  // Extract key metrics
  const httpReqs = data.metrics.http_reqs;
  const httpReqDuration = data.metrics.http_req_duration;
  const httpReqFailed = data.metrics.http_req_failed;
  const successRateMetric = data.metrics.success_rate;

  // Prepare test result object
  const testResult = {
    timestamp: timestamp,
    scenario: scenarioType,
    duration_seconds: data.state.testRunDurationMs / 1000,
    metrics: {
      total_requests: httpReqs?.values?.count || 0,
      requests_per_second: httpReqs?.values?.rate || 0,
      failed_requests: httpReqFailed?.values?.passes || 0,
      success_rate: successRateMetric?.values?.rate || 0,
      error_rate: httpReqFailed?.values?.rate || 0,
      response_times: {
        min: httpReqDuration?.values?.min || 0,
        max: httpReqDuration?.values?.max || 0,
        avg: httpReqDuration?.values?.avg || 0,
        median: httpReqDuration?.values?.med || 0,
        p90: httpReqDuration?.values?.["p(90)"] || 0,
        p95: httpReqDuration?.values?.["p(95)"] || 0,
        p99: httpReqDuration?.values?.["p(99)"] || 0,
      },
    },
    thresholds: {
      passed: Object.keys(data.metrics)
        .filter((key) => data.metrics[key].thresholds)
        .reduce((acc, key) => {
          const metric = data.metrics[key];
          const allPassed = Object.values(metric.thresholds).every((t) => t.ok);
          acc[key] = allPassed;
          return acc;
        }, {}),
    },
    test_configuration: {
      base_url: BASE_URL,
      stages: options.stages,
      thresholds: options.thresholds,
    },
  };

  // Read existing results
  let existingResults = { data: [] };
  try {
    const existingData = open("./wyniki-testow.json");
    if (existingData) {
      existingResults = JSON.parse(existingData);
    }
  } catch (e) {
    console.log("Creating new results file...");
  }

  // Append new result
  existingResults.data.push(testResult);

  // Create individual result file
  const individualFilename = `results/scaling-${scenarioType}-${timestamp.replace(
    /[:.]/g,
    "-"
  )}.json`;

  return {
    // Save to consolidated results file
    "wyniki-testow.json": JSON.stringify(existingResults, null, 2),

    // Save individual test result
    [individualFilename]: JSON.stringify(testResult, null, 2),

    // Console output
    stdout: generateTextSummary(data, testResult),
  };
}

function generateTextSummary(data, testResult) {
  const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    bold: "\x1b[1m",
  };

  let summary = `\n${colors.cyan}${colors.bold}╔═══════════════════════════════════════════════════════════╗${colors.reset}\n`;
  summary += `${colors.cyan}${
    colors.bold
  }║  📊 Scaling Test Results - Scenario: ${testResult.scenario.padEnd(17)}║${
    colors.reset
  }\n`;
  summary += `${colors.cyan}${colors.bold}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n\n`;

  summary += `${colors.yellow}${colors.bold}📅 Test Information:${colors.reset}\n`;
  summary += `  Timestamp: ${testResult.timestamp}\n`;
  summary += `  Scenario: ${testResult.scenario}\n`;
  summary += `  Duration: ${testResult.duration_seconds.toFixed(2)}s\n\n`;

  summary += `${colors.yellow}${colors.bold}📈 Request Statistics:${colors.reset}\n`;
  summary += `  Total Requests: ${testResult.metrics.total_requests}\n`;
  summary += `  Requests/sec: ${testResult.metrics.requests_per_second.toFixed(
    2
  )}\n`;
  summary += `  Failed Requests: ${testResult.metrics.failed_requests}\n`;
  summary += `  Success Rate: ${(testResult.metrics.success_rate * 100).toFixed(
    2
  )}%\n`;
  summary += `  Error Rate: ${(testResult.metrics.error_rate * 100).toFixed(
    2
  )}%\n\n`;

  summary += `${colors.yellow}${colors.bold}⏱️  Response Time Percentiles:${colors.reset}\n`;
  summary += `  Min: ${testResult.metrics.response_times.min.toFixed(2)}ms\n`;
  summary += `  P50 (median): ${testResult.metrics.response_times.median.toFixed(
    2
  )}ms\n`;
  summary += `  P90: ${testResult.metrics.response_times.p90.toFixed(2)}ms\n`;
  summary += `  P95: ${testResult.metrics.response_times.p95.toFixed(2)}ms\n`;
  summary += `  P99: ${testResult.metrics.response_times.p99.toFixed(2)}ms\n`;
  summary += `  Max: ${testResult.metrics.response_times.max.toFixed(2)}ms\n`;
  summary += `  Average: ${testResult.metrics.response_times.avg.toFixed(
    2
  )}ms\n\n`;

  summary += `${colors.yellow}${colors.bold}✅ Threshold Results:${colors.reset}\n`;
  const thresholdsPassed = Object.values(testResult.thresholds.passed).every(
    (v) => v
  );
  const thresholdColor = thresholdsPassed ? colors.green : colors.red;
  const thresholdSymbol = thresholdsPassed ? "✓" : "✗";

  Object.entries(testResult.thresholds.passed).forEach(([key, passed]) => {
    const symbol = passed ? `${colors.green}✓` : `${colors.red}✗`;
    summary += `  ${symbol} ${key}${colors.reset}\n`;
  });

  summary += `\n${colors.cyan}${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`;
  summary += `${colors.cyan}${colors.bold}Results saved to: wyniki-testow.json${colors.reset}\n`;
  summary += `${colors.cyan}${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n\n`;

  return summary;
}
