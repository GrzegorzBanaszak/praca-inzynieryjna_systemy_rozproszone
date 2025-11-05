import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// Metryki dla async
const asyncErrorRate = new Rate("async_errors");
const asyncDuration = new Trend("async_duration");
const asyncCounter = new Counter("async_requests");

// Metryki dla sync
const syncErrorRate = new Rate("sync_errors");
const syncDuration = new Trend("sync_duration");
const syncCounter = new Counter("sync_requests");

export const options = {
  scenarios: {
    async_test: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 20 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
      exec: "asyncScenario",
    },
    sync_test: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 20 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
      exec: "syncScenario",
      startTime: "2m", // Rozpocznij po zakończeniu async_test
    },
  },
  thresholds: {
    async_duration: ["p(95)<2000"],
    sync_duration: ["p(95)<3000"],
    async_errors: ["rate<0.1"],
    sync_errors: ["rate<0.1"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://distributed.local";

function createUser(suffix) {
  const username = `testuser_${suffix}_${__VU}_${Date.now()}`;
  const password = "TestPassword123!";

  const registerPayload = JSON.stringify({ username, password });
  http.post(`${BASE_URL}/api/user/register`, registerPayload, {
    headers: { "Content-Type": "application/json" },
  });

  const loginPayload = JSON.stringify({ username, password });
  const loginRes = http.post(`${BASE_URL}/api/user/login`, loginPayload, {
    headers: { "Content-Type": "application/json" },
  });

  return loginRes.json("token");
}

export function asyncScenario() {
  const token = createUser("async");

  const orderPayload = JSON.stringify({
    productId: "507f1f77bcf86cd799439011",
    quantity: Math.floor(Math.random() * 5) + 1,
  });

  const startTime = new Date();
  const res = http.post(`${BASE_URL}/api/order`, orderPayload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    tags: { type: "async" },
  });
  const duration = new Date() - startTime;

  const success = check(res, {
    "async: status 201": (r) => r.status === 201,
  });

  asyncErrorRate.add(!success);
  asyncDuration.add(duration);
  asyncCounter.add(1);

  sleep(1);
}

export function syncScenario() {
  const token = createUser("sync");

  const orderPayload = JSON.stringify({
    productId: "507f1f77bcf86cd799439011",
    quantity: Math.floor(Math.random() * 5) + 1,
  });

  const startTime = new Date();
  const res = http.post(`${BASE_URL}/api/order/sync`, orderPayload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    tags: { type: "sync" },
    timeout: "30s",
  });
  const duration = new Date() - startTime;

  const success = check(res, {
    "sync: status 201 or 207": (r) => r.status === 201 || r.status === 207,
  });

  syncErrorRate.add(!success);
  syncDuration.add(duration);
  syncCounter.add(1);

  sleep(1);
}

export function handleSummary(data) {
  // Porównanie wyników
  const asyncP95 = data.metrics.async_duration.values["p(95)"];
  const syncP95 = data.metrics.sync_duration.values["p(95)"];
  const asyncErrors = data.metrics.async_errors.values.rate;
  const syncErrors = data.metrics.sync_errors.values.rate;

  console.log("\n======= COMPARISON RESULTS =======");
  console.log(`Async P95: ${asyncP95.toFixed(2)}ms`);
  console.log(`Sync P95: ${syncP95.toFixed(2)}ms`);
  console.log(
    `Difference: ${(syncP95 - asyncP95).toFixed(2)}ms (${(
      (syncP95 / asyncP95 - 1) *
      100
    ).toFixed(1)}% slower)`
  );
  console.log(`Async Error Rate: ${(asyncErrors * 100).toFixed(2)}%`);
  console.log(`Sync Error Rate: ${(syncErrors * 100).toFixed(2)}%`);
  console.log("==================================\n");

  return {
    "summary.json": JSON.stringify(data, null, 2),
  };
}
