import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Definiowanie własnych metryk
const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Konfiguracja testu
export let options = {
    stages: [
        { duration: '10s', target: 50 },   // Rozgrzewka: 50 użytkowników
        { duration: '30s', target: 100 },  // Test właściwy: 100 użytkowników
        { duration: '10s', target: 0 },    // Schładzanie
    ],
    thresholds: {
        'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95% requestów < 500ms, 99% < 1s
        'http_req_failed': ['rate<0.01'],                  // Mniej niż 1% błędów
        'errors': ['rate<0.05'],                           // Mniej niż 5% błędów
    },
    // Eksport wyników do formatu obsługiwanego przez Grafana
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// Bazowy URL - dostosuj do swojego środowiska
const BASE_URL = 'http://distributed.local';

export default function () {
    // Test 1: Pobranie listy produktów
    let response = http.get(`${BASE_URL}/api/product`, {
        tags: { name: 'GetAllProducts' },
    });

    // Sprawdzenie poprawności odpowiedzi
    let checkResult = check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
        'response has body': (r) => r.body.length > 0,
        'content type is JSON': (r) => r.headers['Content-Type']?.includes('application/json'),
    });

    // Aktualizacja metryk
    errorRate.add(!checkResult);
    requestDuration.add(response.timings.duration);
    
    if (response.status === 200) {
        successfulRequests.add(1);
    } else {
        failedRequests.add(1);
        console.error(`Request failed with status: ${response.status}`);
    }

    // Symulacja czasu między requestami (think time)
    sleep(1);
}

// Funkcja wywoływana na końcu testu - generuje podsumowanie
export function handleSummary(data) {
    return {
        'summary-synchroniczne.json': JSON.stringify(data, null, 2),
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    };
}

function textSummary(data, options) {
    const indent = options.indent || '';
    const enableColors = options.enableColors || false;
    
    let summary = '\n' + indent + '=== Test Summary ===\n\n';
    
    // Podstawowe statystyki
    summary += indent + `Total Requests: ${data.metrics.http_reqs.values.count}\n`;
    summary += indent + `Failed Requests: ${data.metrics.http_req_failed.values.passes || 0}\n`;
    summary += indent + `Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)} req/s\n\n`;
    
    // Czasy odpowiedzi
    summary += indent + 'Response Times:\n';
    summary += indent + `  Average: ${data.metrics.http_req_duration.values.avg.toFixed(2)} ms\n`;
    summary += indent + `  Median: ${data.metrics.http_req_duration.values.med.toFixed(2)} ms\n`;
    summary += indent + `  95th percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)} ms\n`;
    summary += indent + `  99th percentile: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)} ms\n`;
    summary += indent + `  Max: ${data.metrics.http_req_duration.values.max.toFixed(2)} ms\n\n`;
    
    return summary;
}
