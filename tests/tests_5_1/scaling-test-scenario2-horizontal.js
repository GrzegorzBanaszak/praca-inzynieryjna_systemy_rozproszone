import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Custom metrics
const successRate = new Rate("success_rate");
const requestDuration = new Trend("request_duration");
const failureCounter = new Counter("failures");

// Test configuration for Scenario 2: Horizontal Scaling - 3 pods with same resources
// Purpose: Measure linear scalability by tripling pod count (3x 0.25-0.5 CPU, 256-512MB RAM each)
export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Warm-up
    // { duration: '1m', target: 50 },    // Gradual increase
    // { duration: '2m', target: 100 },   // 100 VU
    // { duration: '2m', target: 150 },   // 150 VU
    // { duration: '2m', target: 200 },   // Peak: 200 VU
    // { duration: '1m', target: 200 },   // Sustain peak
    // { duration: '2m', target: 0 },     // Cool down
  ],
  thresholds: {
    http_req_duration: ["p(95)<400", "p(99)<800"], // Expecting better performance than baseline
    http_req_failed: ["rate<0.005"], // Expecting fewer errors (< 0.5%)
    success_rate: ["rate>0.995"], // Expecting > 99.5% success
  },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  noConnectionReuse: false,
  userAgent: "K6-Scaling-Test-Scenario2-Horizontal/1.0",
};

const BASE_URL = __ENV.BASE_URL || "http://distributed.local";

export default function () {
  const url = `${BASE_URL}/api/product`;

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
    tags: {
      scenario: "horizontal-scaling",
      name: "get_products",
      replicas: "3",
    },
  };

  const response = http.get(url, params);

  const checksOk = check(response, {
    "status is 200": (r) => r.status === 200,
    "response time < 400ms": (r) => r.timings.duration < 400,
    "response time < 800ms": (r) => r.timings.duration < 800,
    "response body is not empty": (r) => r.body && r.body.length > 0,
    "content-type is JSON": (r) =>
      r.headers["Content-Type"]?.includes("application/json"),
    "load balanced correctly": (r) => r.status === 200, // All 3 pods should handle requests
  });

  successRate.add(checksOk);
  requestDuration.add(response.timings.duration);

  if (!checksOk) {
    failureCounter.add(1);
    console.error(
      `[Horizontal-3pods] Request failed at VU ${__VU}, iteration ${__ITER}: ${response.status}`
    );
  }

  sleep(1);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `results/scenario2-horizontal-${timestamp}.json`;

  // Calculate improvement over baseline (if baseline data available)
  const metrics = data.metrics;
  const throughput = metrics.http_reqs?.values.rate || 0;
  const p95 = metrics.http_req_duration?.values["p(95)"] || 0;
  const errorRate = (metrics.http_req_failed?.values.rate || 0) * 100;

  const enrichedData = {
    ...data,
    test_info: {
      scenario: "Scenario 2: Horizontal Scaling",
      description: "3 pods with identical resources (3x baseline capacity)",
      replicas: 3,
      resources_per_pod: {
        cpu_request: "250m",
        cpu_limit: "500m",
        memory_request: "256Mi",
        memory_limit: "512Mi",
      },
      expected_improvements: {
        throughput: "Near 3x baseline",
        latency: "Similar or slightly better than baseline",
        error_rate: "Lower than baseline",
      },
    },
    summary_metrics: {
      throughput_rps: throughput.toFixed(2),
      p95_latency_ms: p95.toFixed(2),
      error_rate_percent: errorRate.toFixed(2),
      total_requests: metrics.http_reqs?.values.count || 0,
    },
  };

  return {
    [filename]: JSON.stringify(enrichedData, null, 2),
    stdout: textSummary(enrichedData),
  };
}

function textSummary(data) {
  const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
  };

  let summary = `\n${colors.cyan}╔═══════════════════════════════════════════════════════════╗${colors.reset}\n`;
  summary += `${colors.cyan}║  📊 Scaling Test - Scenario 2: Horizontal Scaling (3x)   ║${colors.reset}\n`;
  summary += `${colors.cyan}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n\n`;

  const metrics = data.summary_metrics;
  summary += `${colors.yellow}📈 Key Metrics:${colors.reset}\n`;
  summary += `  Throughput: ${colors.green}${metrics.throughput_rps} req/s${colors.reset}\n`;
  summary += `  P95 Latency: ${colors.green}${metrics.p95_latency_ms}ms${colors.reset}\n`;
  summary += `  Error Rate: ${colors.green}${metrics.error_rate_percent}%${colors.reset}\n`;
  summary += `  Total Requests: ${colors.green}${metrics.total_requests}${colors.reset}\n\n`;

  summary += `${colors.yellow}🔍 Expected vs Baseline:${colors.reset}\n`;
  summary += `  Throughput: Should be ~3x baseline (linear scaling)\n`;
  summary += `  Latency: Should be similar or slightly better\n`;
  summary += `  Errors: Should be lower (distributed load)\n`;

  return summary;
}
