import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Custom metrics for detailed analysis
const successRate = new Rate("success_rate");
const requestDuration = new Trend("request_duration");
const failureCounter = new Counter("failures");

// Test configuration for Scenario 1: Baseline - Single pod with limited resources
// Purpose: Establish baseline performance with minimal resources (0.25-0.5 CPU, 256-512MB RAM)
export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Warm-up: ramp up to 10 VU
    { duration: "1m", target: 50 }, // Gradual increase to 50 VU
    { duration: "2m", target: 100 }, // Increase to 100 VU
    { duration: "2m", target: 150 }, // Increase to 150 VU
    { duration: "2m", target: 200 }, // Maximum load: 200 VU
    { duration: "1m", target: 200 }, // Sustain peak load
    { duration: "2m", target: 0 }, // Cool down: gradual decrease
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"], // 95% < 500ms, 99% < 1s
    http_req_failed: ["rate<0.01"], // Less than 1% errors
    success_rate: ["rate>0.99"], // More than 99% success
  },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  noConnectionReuse: false,
  userAgent: "K6-Scaling-Test-Scenario1-Baseline/1.0",
};

const BASE_URL = __ENV.BASE_URL || "http://distributed.local";

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
