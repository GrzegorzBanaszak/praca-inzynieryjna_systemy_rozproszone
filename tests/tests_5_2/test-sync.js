import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// Własne metryki
const errorRate = new Rate("errors");
const orderCreationTime = new Trend("order_creation_time", true);
const notificationTime = new Trend("notification_time", true);
const successfulOrders = new Counter("successful_orders");
const failedOrders = new Counter("failed_orders");
const partialSuccessOrders = new Counter("partial_success_orders"); // 207 status

// Konfiguracja testu - taka sama jak async dla porównywalności
export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 20 },
    { duration: "2m", target: 20 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<3000"], // Wyższy próg dla sync
    errors: ["rate<0.1"],
    "http_req_duration{type:sync}": ["p(99)<5000"],
  },
  tags: {
    test_type: "sync",
    test_name: "sync-order-creation",
  },
};

const BASE_URL = __ENV.BASE_URL || "http://distributed.local";
const USERNAME = `testuser_sync_${__VU}_${Date.now()}`;
const PASSWORD = "TestPassword123!";

const testStartTime = new Date();

export function setup() {
  console.log(`\n========================================`);
  console.log(`SYNC TEST STARTING AT: ${testStartTime.toISOString()}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`========================================\n`);

  console.log(`Setting up test user: ${USERNAME}`);

  const registerPayload = JSON.stringify({
    username: USERNAME,
    password: PASSWORD,
  });

  const registerRes = http.post(
    `${BASE_URL}/api/user/register`,
    registerPayload,
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  if (registerRes.status !== 200) {
    console.error(
      `Registration failed: ${registerRes.status} ${registerRes.body}`
    );
    throw new Error("Setup failed - could not register user");
  }

  const loginPayload = JSON.stringify({
    username: USERNAME,
    password: PASSWORD,
  });

  const loginRes = http.post(`${BASE_URL}/api/user/login`, loginPayload, {
    headers: { "Content-Type": "application/json" },
  });

  if (loginRes.status !== 200) {
    console.error(`Login failed: ${loginRes.status} ${loginRes.body}`);
    throw new Error("Setup failed - could not login");
  }

  const token = loginRes.json("token");

  if (!token) {
    throw new Error("Setup failed - no token received");
  }

  console.log(`Setup completed successfully. Token received.`);

  return {
    token,
    testStartTime: testStartTime.toISOString(),
  };
}

export default function (data) {
  // Tworzenie zamówienia SYNCHRONICZNIE (nowy endpoint)
  const orderPayload = JSON.stringify({
    productId: "507f1f77bcf86cd799439011",
    quantity: Math.floor(Math.random() * 5) + 1,
  });

  const startTime = new Date();
  const orderRes = http.post(
    `${BASE_URL}/api/order/sync`, // SYNCHRONICZNY endpoint
    orderPayload,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.token}`,
      },
      tags: {
        type: "sync",
        endpoint: "create_order_sync",
      },
      timeout: "30s",
    }
  );
  const endTime = new Date();
  const duration = endTime - startTime;

  // Sprawdzenie odpowiedzi z rozróżnieniem na pełny sukces i partial success
  const fullSuccess = check(orderRes, {
    "sync order created successfully (status 201)": (r) => r.status === 201,
    "response has order id": (r) => {
      try {
        const body = r.json();
        return body.id !== undefined && body.id !== null;
      } catch (e) {
        return false;
      }
    },
  });

  const partialSuccess = check(orderRes, {
    "partial success - order created but notification failed (status 207)": (
      r
    ) => r.status === 207,
  });

  const anySuccess = fullSuccess || partialSuccess;

  // Aktualizacja metryk
  errorRate.add(!anySuccess);
  orderCreationTime.add(duration);
  notificationTime.add(duration); // W sync całkowity czas = czas z notyfikacją

  if (fullSuccess) {
    successfulOrders.add(1);
  } else if (partialSuccess) {
    partialSuccessOrders.add(1);
  } else {
    failedOrders.add(1);
    console.error(
      `[VU ${__VU}] Sync order creation failed: ${orderRes.status} ${orderRes.body}`
    );
  }

  sleep(1);
}

export function teardown(data) {
  const testEndTime = new Date();
  console.log(`\n========================================`);
  console.log(`SYNC TEST COMPLETED AT: ${testEndTime.toISOString()}`);
  console.log(
    `Test duration: ${((testEndTime - testStartTime) / 1000).toFixed(2)}s`
  );
  console.log(`========================================\n`);
}

export function handleSummary(data) {
  const testEndTime = new Date();
  const testDurationSeconds = (testEndTime - testStartTime) / 1000;

  // Generowanie znacznika czasu dla nazw plików (format: YYYY-MM-DD_HH-MM-SS)
  const timestamp = testEndTime
    .toISOString()
    .replace(/T/, "_")
    .replace(/:/g, "-")
    .replace(/\..+/, "");

  // Bezpieczne pobieranie metryk z walidacją
  const metrics = data.metrics || {};
  const httpReqDuration = metrics.http_req_duration || { values: {} };
  const httpReqs = metrics.http_reqs || { values: { count: 0 } };
  const errors = metrics.errors || { values: { rate: 0 } };
  const orderCreation = metrics.order_creation_time || { values: {} };
  const notification = metrics.notification_time || { values: {} };
  const successfulOrdersCount = metrics.successful_orders?.values?.count || 0;
  const failedOrdersCount = metrics.failed_orders?.values?.count || 0;
  const partialSuccessCount =
    metrics.partial_success_orders?.values?.count || 0;

  // Pomocnicza funkcja do bezpiecznego formatowania wartości
  const safeFormat = (value, decimals = 2, defaultValue = 0) => {
    if (value === undefined || value === null || isNaN(value)) {
      return defaultValue.toFixed(decimals);
    }
    return Number(value).toFixed(decimals);
  };

  // Bezpieczne pobieranie wartości z obiektu values
  const getMetricValue = (metric, key, defaultValue = 0) => {
    return metric?.values?.[key] !== undefined
      ? metric.values[key]
      : defaultValue;
  };

  const customSummary = `
================================================================================
                    K6 LOAD TEST RESULTS - SYNC ORDERS
================================================================================

Test Configuration:
------------------
Test Type:           Synchronous Order Creation (with notification wait)
Base URL:            ${BASE_URL}
Test Start:          ${testStartTime.toISOString()}
Test End:            ${testEndTime.toISOString()}
Total Duration:      ${safeFormat(testDurationSeconds)}s

Overall Statistics:
------------------
Total Requests:      ${getMetricValue(httpReqs, "count")}
Successful Orders:   ${successfulOrdersCount}
Partial Success:     ${partialSuccessCount}
Failed Orders:       ${failedOrdersCount}
Error Rate:          ${safeFormat(getMetricValue(errors, "rate") * 100)}%
Requests/sec:        ${safeFormat(
    getMetricValue(httpReqs, "count") / testDurationSeconds
  )}

HTTP Request Duration (from user perspective - includes notification):
--------------------------------------------------------------------
Min:                 ${safeFormat(getMetricValue(httpReqDuration, "min"))}ms
Avg:                 ${safeFormat(getMetricValue(httpReqDuration, "avg"))}ms
Med (p50):           ${safeFormat(getMetricValue(httpReqDuration, "med"))}ms
p90:                 ${safeFormat(getMetricValue(httpReqDuration, "p(90)"))}ms
p95:                 ${safeFormat(getMetricValue(httpReqDuration, "p(95)"))}ms
p99:                 ${safeFormat(getMetricValue(httpReqDuration, "p(99)"))}ms
Max:                 ${safeFormat(getMetricValue(httpReqDuration, "max"))}ms

Order Creation Time (total with notification):
---------------------------------------------
Min:                 ${safeFormat(getMetricValue(orderCreation, "min"))}ms
Avg:                 ${safeFormat(getMetricValue(orderCreation, "avg"))}ms
Med (p50):           ${safeFormat(getMetricValue(orderCreation, "med"))}ms
p90:                 ${safeFormat(getMetricValue(orderCreation, "p(90)"))}ms
p95:                 ${safeFormat(getMetricValue(orderCreation, "p(95)"))}ms
p99:                 ${safeFormat(getMetricValue(orderCreation, "p(99)"))}ms
Max:                 ${safeFormat(getMetricValue(orderCreation, "max"))}ms

Notification Time (same as order creation in sync mode):
-------------------------------------------------------
Min:                 ${safeFormat(getMetricValue(notification, "min"))}ms
Avg:                 ${safeFormat(getMetricValue(notification, "avg"))}ms
Med (p50):           ${safeFormat(getMetricValue(notification, "med"))}ms
p90:                 ${safeFormat(getMetricValue(notification, "p(90)"))}ms
p95:                 ${safeFormat(getMetricValue(notification, "p(95)"))}ms
p99:                 ${safeFormat(getMetricValue(notification, "p(99)"))}ms
Max:                 ${safeFormat(getMetricValue(notification, "max"))}ms

HTTP Status Codes:
-----------------
${
  data.root_group?.checks
    ? Object.entries(data.root_group.checks)
        .map(([name, value]) => {
          const total = value.passes + value.fails;
          const percentage =
            total > 0 ? ((value.passes / total) * 100).toFixed(1) : "0.0";
          return `${name}: ${value.passes}/${total} (${percentage}%)`;
        })
        .join("\n")
    : "No check data available"
}

Thresholds:
----------
${
  data.thresholds
    ? Object.entries(data.thresholds)
        .map(
          ([name, threshold]) =>
            `${name}: ${threshold.ok ? "✓ PASSED" : "✗ FAILED"}`
        )
        .join("\n")
    : "No threshold data available"
}

================================================================================
`;

  const jsonResults = {
    test_info: {
      test_type: "sync",
      test_name: "sync-order-creation",
      base_url: BASE_URL,
      start_time: testStartTime.toISOString(),
      end_time: testEndTime.toISOString(),
      duration_seconds: testDurationSeconds,
      timestamp: timestamp,
    },
    summary: {
      total_requests: getMetricValue(httpReqs, "count"),
      successful_orders: successfulOrdersCount,
      partial_success_orders: partialSuccessCount,
      failed_orders: failedOrdersCount,
      error_rate: getMetricValue(errors, "rate"),
      requests_per_second:
        getMetricValue(httpReqs, "count") / testDurationSeconds,
    },
    http_req_duration: {
      min: getMetricValue(httpReqDuration, "min"),
      avg: getMetricValue(httpReqDuration, "avg"),
      med: getMetricValue(httpReqDuration, "med"),
      p90: getMetricValue(httpReqDuration, "p(90)"),
      p95: getMetricValue(httpReqDuration, "p(95)"),
      p99: getMetricValue(httpReqDuration, "p(99)"),
      max: getMetricValue(httpReqDuration, "max"),
    },
    order_creation_time: {
      min: getMetricValue(orderCreation, "min"),
      avg: getMetricValue(orderCreation, "avg"),
      med: getMetricValue(orderCreation, "med"),
      p90: getMetricValue(orderCreation, "p(90)"),
      p95: getMetricValue(orderCreation, "p(95)"),
      p99: getMetricValue(orderCreation, "p(99)"),
      max: getMetricValue(orderCreation, "max"),
    },
    notification_time: {
      min: getMetricValue(notification, "min"),
      avg: getMetricValue(notification, "avg"),
      med: getMetricValue(notification, "med"),
      p90: getMetricValue(notification, "p(90)"),
      p95: getMetricValue(notification, "p(95)"),
      p99: getMetricValue(notification, "p(99)"),
      max: getMetricValue(notification, "max"),
    },
    thresholds: data.thresholds
      ? Object.entries(data.thresholds).reduce((acc, [name, threshold]) => {
          acc[name] = threshold.ok;
          return acc;
        }, {})
      : {},
    raw_metrics: metrics,
  };

  console.log(customSummary);
  console.log(`\nResults will be saved with timestamp: ${timestamp}`);

  return {
    // Raport tekstowy - czytelny dla człowieka
    // [`results/sync-summary_${timestamp}.txt`]: customSummary,

    // Pełne dane JSON - do analizy programowej
    [`results/sync-results_${timestamp}.json`]: JSON.stringify(
      jsonResults,
      null,
      2
    ),

    // Standardowe podsumowanie k6 (zawiera wszystkie szczegóły)
    // [`results/sync-full-report_${timestamp}.txt`]: textSummary(data, {
    //   indent: " ",
    //   enableColors: false,
    // }),

    // HTML raport - wizualizacja w przeglądarce
    // [`results/sync-report_${timestamp}.html`]: htmlReport(data),

    // Surowe dane k6 w JSON (do zaawansowanej analizy)
    [`results/sync-raw-data_${timestamp}.json`]: JSON.stringify(data, null, 2),
  };
}
