import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';

// Custom metrics
const successRate = new Rate('success_rate');
const requestDuration = new Trend('request_duration');
const failureCounter = new Counter('failures');
const currentVUs = new Gauge('current_vus');

// Test configuration for Scenario 4: Auto-scaling (HPA - Horizontal Pod Autoscaler)
// Purpose: Test dynamic scaling behavior as load increases and decreases
// HPA should scale from 1 to 5 pods based on CPU utilization (target: 70%)
export const options = {
  stages: [
    // Phase 1: Low load - should maintain 1 pod
    { duration: '1m', target: 10 },    // Very low load
    { duration: '1m', target: 10 },    // Sustain low load
    
    // Phase 2: Medium load - should trigger scaling to 2-3 pods
    { duration: '1m', target: 75 },    // Medium load
    { duration: '2m', target: 75 },    // Sustain to allow HPA to react
    
    // Phase 3: High load - should scale to 4-5 pods
    { duration: '1m', target: 150 },   // High load
    { duration: '3m', target: 150 },   // Longer sustain for full scale-out
    
    // Phase 4: Peak load - test at maximum capacity
    { duration: '1m', target: 200 },   // Peak load
    { duration: '2m', target: 200 },   // Sustain peak
    
    // Phase 5: Scale down - should gradually reduce pods
    { duration: '2m', target: 75 },    // Drop to medium
    { duration: '2m', target: 75 },    // Sustain to trigger scale-down
    { duration: '1m', target: 10 },    // Return to low
    { duration: '2m', target: 10 },    // Final sustain
    { duration: '1m', target: 0 },     // Cool down
  ],
  thresholds: {
    // More lenient thresholds to account for scaling transitions
    'http_req_duration': ['p(95)<600', 'p(99)<1200'],
    'http_req_failed': ['rate<0.02'],  // Allow 2% errors during scale transitions
    'success_rate': ['rate>0.98'],     // 98% success acceptable with dynamic scaling
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  noConnectionReuse: false,
  userAgent: 'K6-Scaling-Test-Scenario4-HPA/1.0',
};

const BASE_URL = __ENV.BASE_URL || 'http://distributed.local';

export default function () {
  const url = `${BASE_URL}/api/product`;
  
  // Record current VU count for analysis
  currentVUs.add(__VU);
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { 
      scenario: 'hpa-autoscaling',
      name: 'get_products',
      stage: getCurrentStage()
    },
  };

  const response = http.get(url, params);

  const checksOk = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 600ms': (r) => r.timings.duration < 600,
    'response time < 1200ms': (r) => r.timings.duration < 1200,
    'response body is not empty': (r) => r.body && r.body.length > 0,
    'content-type is JSON': (r) => r.headers['Content-Type']?.includes('application/json'),
  });

  successRate.add(checksOk);
  requestDuration.add(response.timings.duration);
  
  if (!checksOk) {
    failureCounter.add(1);
    const stage = getCurrentStage();
    console.error(`[HPA-${stage}] Request failed at VU ${__VU}, iteration ${__ITER}: ${response.status}`);
  }

  sleep(1);
}

// Helper function to determine current test stage
function getCurrentStage() {
  const vu = __VU;
  if (vu <= 10) return 'low-load';
  if (vu <= 75) return 'medium-load';
  if (vu <= 150) return 'high-load';
  if (vu <= 200) return 'peak-load';
  return 'scale-down';
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `results/scenario4-hpa-${timestamp}.json`;
  
  const metrics = data.metrics;
  const throughput = metrics.http_reqs?.values.rate || 0;
  const p95 = metrics.http_req_duration?.values['p(95)'] || 0;
  const errorRate = (metrics.http_req_failed?.values.rate || 0) * 100;

  const enrichedData = {
    ...data,
    test_info: {
      scenario: 'Scenario 4: Horizontal Pod Autoscaler (HPA)',
      description: 'Dynamic scaling from 1 to 5 pods based on CPU utilization (target: 70%)',
      hpa_config: {
        min_replicas: 1,
        max_replicas: 5,
        target_cpu_utilization: 70,
        scale_up_stabilization: '0s (immediate)',
        scale_down_stabilization: '300s (5 min)',
      },
      resources_per_pod: {
        cpu_request: '250m',
        cpu_limit: '500m',
        memory_request: '256Mi',
        memory_limit: '512Mi'
      },
      test_phases: [
        { phase: 'Low Load', vus: 10, duration: '2m', expected_pods: 1 },
        { phase: 'Medium Load', vus: 75, duration: '3m', expected_pods: '2-3' },
        { phase: 'High Load', vus: 150, duration: '4m', expected_pods: '4-5' },
        { phase: 'Peak Load', vus: 200, duration: '3m', expected_pods: 5 },
        { phase: 'Scale Down', vus: '75→10', duration: '5m', expected_pods: '5→1' },
      ],
      key_observations: [
        'HPA reaction time (scale-up)',
        'Pod creation latency',
        'Performance during scaling transitions',
        'Scale-down behavior and stabilization',
        'Resource efficiency vs static configurations'
      ]
    },
    summary_metrics: {
      throughput_rps: throughput.toFixed(2),
      p95_latency_ms: p95.toFixed(2),
      error_rate_percent: errorRate.toFixed(2),
      total_requests: metrics.http_reqs?.values.count || 0,
      test_duration_minutes: 20,
    },
    analysis_notes: {
      advantages: [
        'Automatic resource adjustment',
        'Cost optimization during low traffic',
        'Maintains performance during spikes',
        'No manual intervention required'
      ],
      challenges: [
        'Scale-up delay (pod creation ~30-60s)',
        'Potential errors during transitions',
        'Scale-down is intentionally slow (5 min stabilization)',
        'Requires careful threshold tuning'
      ],
      recommendations: [
        'Monitor HPA events in kubectl get hpa',
        'Use Grafana to correlate pod count with performance',
        'Consider Vertical Pod Autoscaler (VPA) for right-sizing',
        'Implement readiness probes for smooth transitions'
      ]
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
    blue: '\x1b[34m',
  };

  let summary = `\n${colors.cyan}╔═══════════════════════════════════════════════════════════╗${colors.reset}\n`;
  summary += `${colors.cyan}║  📊 Scaling Test - Scenario 4: HPA Auto-scaling          ║${colors.reset}\n`;
  summary += `${colors.cyan}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n\n`;

  const metrics = data.summary_metrics;
  summary += `${colors.yellow}📈 Overall Performance:${colors.reset}\n`;
  summary += `  Throughput: ${colors.green}${metrics.throughput_rps} req/s${colors.reset}\n`;
  summary += `  P95 Latency: ${colors.green}${metrics.p95_latency_ms}ms${colors.reset}\n`;
  summary += `  Error Rate: ${colors.green}${metrics.error_rate_percent}%${colors.reset}\n`;
  summary += `  Total Requests: ${colors.green}${metrics.total_requests}${colors.reset}\n`;
  summary += `  Test Duration: ${colors.green}${metrics.test_duration_minutes} minutes${colors.reset}\n\n`;

  summary += `${colors.yellow}🔄 Test Phases (observe in Grafana):${colors.reset}\n`;
  data.test_info.test_phases.forEach((phase, i) => {
    summary += `  ${i + 1}. ${colors.blue}${phase.phase}${colors.reset}: `;
    summary += `${phase.vus} VUs for ${phase.duration} → `;
    summary += `Expected: ${colors.green}${phase.expected_pods} pods${colors.reset}\n`;
  });

  summary += `\n${colors.yellow}📊 HPA Configuration:${colors.reset}\n`;
  const hpa = data.test_info.hpa_config;
  summary += `  Min/Max Replicas: ${colors.green}${hpa.min_replicas}/${hpa.max_replicas}${colors.reset}\n`;
  summary += `  CPU Target: ${colors.green}${hpa.target_cpu_utilization}%${colors.reset}\n`;
  summary += `  Scale-up: ${colors.green}${hpa.scale_up_stabilization}${colors.reset}\n`;
  summary += `  Scale-down: ${colors.green}${hpa.scale_down_stabilization}${colors.reset}\n\n`;

  summary += `${colors.yellow}💡 Key Insights:${colors.reset}\n`;
  summary += `  ${colors.cyan}✓${colors.reset} HPA provides automatic resource optimization\n`;
  summary += `  ${colors.cyan}✓${colors.reset} Cost-efficient: scales down during low traffic\n`;
  summary += `  ${colors.cyan}⚠${colors.reset}  Scale-up has 30-60s delay (pod creation time)\n`;
  summary += `  ${colors.cyan}⚠${colors.reset}  Scale-down is slow by design (5 min stabilization)\n\n`;

  summary += `${colors.yellow}📌 Action Items:${colors.reset}\n`;
  summary += `  1. Run: kubectl get hpa -n distributed-system -w\n`;
  summary += `  2. Check pod count: kubectl get pods -n distributed-system\n`;
  summary += `  3. View Grafana dashboard for CPU/memory/pod count correlation\n`;
  summary += `  4. Compare with baseline and horizontal scaling results\n`;

  return summary;
}
