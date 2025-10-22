/**
 * Konfiguracje dla różnych wariantów testu 5.1
 * 
 * Użycie:
 * k6 run -e VARIANT=light test-synchroniczne.js
 * k6 run -e VARIANT=heavy test-synchroniczne.js
 */

// Definicje wariantów testowych
const variants = {
    // Wariant lekki - dla środowisk developerskich
    light: {
        stages: [
            { duration: '5s', target: 10 },   // Rozgrzewka
            { duration: '10s', target: 50 },  // Ramp-up
            { duration: '20s', target: 50 },  // Test
            { duration: '5s', target: 0 },    // Cool-down
        ],
        thresholds: {
            'http_req_duration': ['p(95)<800'],
            'http_req_failed': ['rate<0.10'],
        },
    },
    
    // Wariant standardowy - domyślny z README
    standard: {
        stages: [
            { duration: '5s', target: 20 },
            { duration: '10s', target: 100 },
            { duration: '30s', target: 100 },
            { duration: '5s', target: 0 },
        ],
        thresholds: {
            'http_req_duration': ['p(95)<500'],
            'http_req_failed': ['rate<0.05'],
        },
    },
    
    // Wariant ciężki - dla testów wydajnościowych
    heavy: {
        stages: [
            { duration: '10s', target: 50 },
            { duration: '15s', target: 200 },
            { duration: '60s', target: 200 },
            { duration: '10s', target: 0 },
        ],
        thresholds: {
            'http_req_duration': ['p(95)<1000'],
            'http_req_failed': ['rate<0.10'],
        },
    },
    
    // Wariant skok - nagły wzrost obciążenia
    spike: {
        stages: [
            { duration: '5s', target: 50 },   // Stabilne obciążenie
            { duration: '2s', target: 500 },  // Nagły skok!
            { duration: '30s', target: 500 }, // Utrzymanie szczytu
            { duration: '5s', target: 50 },   // Powrót do normy
            { duration: '5s', target: 0 },
        ],
        thresholds: {
            'http_req_duration': ['p(95)<2000'],
            'http_req_failed': ['rate<0.15'],
        },
    },
    
    // Wariant stres - stopniowe zwiększanie
    stress: {
        stages: [
            { duration: '30s', target: 50 },
            { duration: '30s', target: 100 },
            { duration: '30s', target: 150 },
            { duration: '30s', target: 200 },
            { duration: '30s', target: 250 },
            { duration: '30s', target: 300 },
            { duration: '10s', target: 0 },
        ],
        thresholds: {
            'http_req_duration': ['p(95)<1500'],
            'http_req_failed': ['rate<0.20'],
        },
    },
    
    // Wariant soak - długotrwałe obciążenie (30 min)
    soak: {
        stages: [
            { duration: '2m', target: 100 },
            { duration: '28m', target: 100 },  // 30 minut przy stałym obciążeniu
            { duration: '2m', target: 0 },
        ],
        thresholds: {
            'http_req_duration': ['p(95)<600'],
            'http_req_failed': ['rate<0.05'],
            // Sprawdź czy nie ma wycieków pamięci
        },
    },
};

// Eksport wybranego wariantu lub domyślnego
const selectedVariant = __ENV.VARIANT || 'standard';
const config = variants[selectedVariant] || variants.standard;

console.log(`=== Uruchamianie testu w wariancie: ${selectedVariant} ===`);

export { config };
