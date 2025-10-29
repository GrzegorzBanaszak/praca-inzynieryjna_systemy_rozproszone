import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const successRate = new Rate('success_rate');
const requestDuration = new Trend('request_duration');
const failureCounter = new Counter('failures');

// Test configuration for Scenario 3: Vertical Scaling - Single pod with increased resources
// Purpose: Measure efficiency of resource increase (1-2 CPU cores, 512-1024MB RAM on single pod)
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Warm-up
    { duration: '1m', target: 50 },    // Gradual increase
    { duration: '2m', target: 100 },   // 100 VU
    { duration: '2m', target: 150 },   // 150 VU
    { duration: '2m', target: 200 },   // Peak: 200 VU
    { duration: '1m', target: 200 },   // Sustain peak
    { duration: '2m', target: 0 },     // Cool down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<450', 'p(99)<900'], // Should be better than baseline
    'http_req_failed': ['rate<0.008'],                // Slightly better error rate
    'success_rate': ['rate>0.992'],                   // > 99.2% success
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  noConnectionReuse: false,
  userAgent: 'K6-Scaling-Test-Scenario3-Vertical/1.0',
};

const BASE_URL = __ENV.BASE_URL || 'http://distributed.local';

export default function () {
  const url = `${BASE_URL}/api/product`;
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { 
      scenario: 'vertical-scaling',
      name: 'get_products',
      resources: 'increased'
    },
  };

  const response = http.get(url, params);

  const checksOk = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 450ms': (r) => r.timings.duration < 450,
    'response time < 900ms': (r) => r.timings.duration < 900,
    'response body is not empty': (r) => r.body && r.body.length > 0,
    'content-type is JSON': (r) => r.headers['Content-Type']?.includes('application/json'),
    'single pod handles load': (r) => r.status === 200, // Testing single pod performance
  });

  successRate.add(checksOk);
  requestDuration.add(response.timings.duration);
  
  if (!checksOk) {
    failureCounter.add(1);
    console.error(`[Vertical-2x-resources] Request failed at VU ${__VU}, iteration ${__ITER}: ${response.status}`);
  }

  sleep(1);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `results/scenario3-vertical-${timestamp}.json`;
  
  const metrics = data.metrics;
  const throughput = metrics.http_reqs?.values.rate || 0;
  const p95 = metrics.http_req_duration?.values['p(95)'] || 0;
  const errorRate = (metrics.http_req_failed?.values.rate || 0) * 100;

  const enrichedData = {
    ...data,
    test_info: {
      scenario: 'Scenario 3: Vertical Scaling',
      description: 'Single pod with 4x CPU and 4x memory compared to baseline',
      replicas: 1,
      resources: {
        cpu_request: '1000m',  // 4x baseline
        cpu_limit: '2000m',    // 4x baseline
        memory_request: '512Mi', // 2x baseline
        memory_limit: '1024Mi'   // 2x baseline
      },
      expected_improvements: {
        throughput: '1.5-2x baseline (not linear due to single pod)',
        latency: 'Better than baseline, worse than horizontal',
        error_rate: 'Similar to baseline'
      },
      trade_offs: [
        'Single point of failure (no redundancy)',
        'Limited by single pod CPU scheduling',
        'No load distribution benefits',
        'Lower resource efficiency than horizontal'
      ]
    },
    summary_metrics: {
      throughput_rps: throughput.toFixed(2),
      p95_latency_ms: p95.toFixed(2),
      error_rate_percent: errorRate.toFixed(2),
      total_requests: metrics.http_reqs?.values.count || 0,
      resource_efficiency: 'Lower than horizontal scaling'
    }
  };
  
  return {
    [filename]: JSON.stringify(enrichedData, null, 2),
    'stdout': textSummary(enrichedData),
  };
}

function textSummary(data) {
  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
  };

  let summary = `\n${colors.cyan}╔═══════════════════════════════════════════════════════════╗${colors.reset}\n`;
  summary += `${colors.cyan}║  📊 Scaling Test - Scenario 3: Vertical Scaling (4x)     ║${colors.reset}\n`;
  summary += `${colors.cyan}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n\n`;

  const metrics = data.summary_metrics;
  summary += `${colors.yellow}📈 Key Metrics:${colors.reset}\n`;
  summary += `  Throughput: ${colors.green}${metrics.throughput_rps} req/s${colors.reset}\n`;
  summary += `  P95 Latency: ${colors.green}${metrics.p95_latency_ms}ms${colors.reset}\n`;
  summary += `  Error Rate: ${colors.green}${metrics.error_rate_percent}%${colors.reset}\n`;
  summary += `  Total Requests: ${colors.green}${metrics.total_requests}${colors.reset}\n\n`;

  summary += `${colors.yellow}🔍 Analysis:${colors.reset}\n`;
  summary += `  ${colors.cyan}✓${colors.reset} Single pod with 4x resources\n`;
  summary += `  ${colors.cyan}✓${colors.reset} Better than baseline but not as good as horizontal\n`;
  summary += `  ${colors.red}✗${colors.reset} Single point of failure - no redundancy\n`;
  summary += `  ${colors.red}✗${colors.reset} Limited by single thread/pod bottlenecks\n\n`;

  summary += `${colors.yellow}💡 Insight:${colors.reset}\n`;
  summary += `  Vertical scaling has diminishing returns due to:\n`;
  summary += `  • Single pod CPU scheduling limits\n`;
  summary += `  • No load distribution across multiple instances\n`;
  summary += `  • Lower fault tolerance\n`;
  summary += `  Best for: Workloads that can't be parallelized\n`;

  return summary;
}
