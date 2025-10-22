/**
 * Test 5.1: Krótkotrwałe zapytania synchroniczne
 * 
 * Cel: Zmierzenie przepustowości systemu oraz opóźnienia odpowiedzi
 * w warunkach intensywnego, lecz krótkotrwałego ruchu synchronicznego.
 * 
 * Scenariusz:
 * - 100 wirtualnych użytkowników
 * - Czas trwania: 30 sekund
 * - Zapytania GET do ProductService przez ApiGateway
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Konfiguracja adresu API Gateway
const API_GATEWAY = __ENV.API_GATEWAY || 'http://localhost:80';

// Definiowanie własnych metryk
const errorRate = new Rate('errors');
const responseTimeTrend = new Trend('response_time');
const requestCounter = new Counter('requests_total');

// Konfiguracja testu
export const options = {
    stages: [
        { duration: '5s', target: 20 },   // Rozgrzewka: 20 VU przez 5s
        { duration: '10s', target: 100 }, // Ramp-up: zwiększenie do 100 VU
        { duration: '30s', target: 100 }, // Test właściwy: 100 VU przez 30s
        { duration: '5s', target: 0 },    // Cool-down: zmniejszenie do 0
    ],
    thresholds: {
        'http_req_duration': ['p(95)<500'], // 95% żądań poniżej 500ms
        'http_req_failed': ['rate<0.05'],   // Mniej niż 5% błędów
        'errors': ['rate<0.05'],
    },
};

// Funkcja setup - wykonywana raz przed testem
export function setup() {
    console.log('=== Rozpoczynanie testu 5.1: Krótkotrwałe zapytania synchroniczne ===');
    console.log(`API Gateway: ${API_GATEWAY}`);
    console.log(`Data/czas: ${new Date().toISOString()}`);
    
    // Sprawdzenie dostępności API
    const healthCheck = http.get(`${API_GATEWAY}/api/product/healthz`);
    if (healthCheck.status !== 200) {
        console.error('BŁĄD: API Gateway nie jest dostępne!');
        throw new Error('API Gateway health check failed');
    }
    console.log('Health check: OK');
    
    return {
        startTime: new Date().toISOString(),
        apiGateway: API_GATEWAY
    };
}

// Główna funkcja testowa - wykonywana przez każdego VU
export default function(data) {
    // Scenariusz 1: Pobranie listy wszystkich produktów
    const listResponse = http.get(`${API_GATEWAY}/api/product`, {
        tags: { name: 'GetAllProducts' },
        timeout: '10s'
    });
    
    requestCounter.add(1);
    responseTimeTrend.add(listResponse.timings.duration);
    
    const listCheckResult = check(listResponse, {
        'GET /api/product - status 200': (r) => r.status === 200,
        'GET /api/product - odpowiedź w JSON': (r) => r.headers['Content-Type']?.includes('application/json'),
        'GET /api/product - zawiera produkty': (r) => {
            try {
                const body = JSON.parse(r.body);
                return Array.isArray(body);
            } catch (e) {
                return false;
            }
        },
        'GET /api/product - czas < 1s': (r) => r.timings.duration < 1000,
    });
    
    errorRate.add(!listCheckResult);
    
    // Krótka przerwa między żądaniami (symulacja "think time")
    sleep(0.1);
    
    // Scenariusz 2: Pobranie konkretnego produktu (jeśli lista nie jest pusta)
    if (listResponse.status === 200) {
        try {
            const products = JSON.parse(listResponse.body);
            if (products && products.length > 0) {
                const randomProduct = products[Math.floor(Math.random() * products.length)];
                
                const detailResponse = http.get(`${API_GATEWAY}/api/product/${randomProduct.id}`, {
                    tags: { name: 'GetProductById' },
                    timeout: '10s'
                });
                
                requestCounter.add(1);
                responseTimeTrend.add(detailResponse.timings.duration);
                
                const detailCheckResult = check(detailResponse, {
                    'GET /api/product/:id - status 200': (r) => r.status === 200,
                    'GET /api/product/:id - zawiera ID': (r) => {
                        try {
                            const body = JSON.parse(r.body);
                            return body.id === randomProduct.id;
                        } catch (e) {
                            return false;
                        }
                    },
                    'GET /api/product/:id - czas < 1s': (r) => r.timings.duration < 1000,
                });
                
                errorRate.add(!detailCheckResult);
            }
        } catch (e) {
            console.error(`Błąd parsowania odpowiedzi: ${e.message}`);
            errorRate.add(1);
        }
    }
    
    sleep(0.2);
}

// Funkcja teardown - wykonywana raz po teście
export function teardown(data) {
    console.log('=== Test zakończony ===');
    console.log(`Czas rozpoczęcia: ${data.startTime}`);
    console.log(`Czas zakończenia: ${new Date().toISOString()}`);
}
