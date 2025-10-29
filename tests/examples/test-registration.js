import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.30"],
  },
};

const BASE_URL = "http://distributed.local";

export default function () {
  const username = `testuser_${__VU}_${__ITER}`;
  const payload = JSON.stringify({
    username: username,
    password: "TestPassword123",
  });

  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const response = http.post(`${BASE_URL}/api/user/register`, payload, params);

  const registerSuccess = check(response, {
    "status jest 200 lub 201": (r) => r.status === 200 || r.status === 201,
    "nie ma błędu serwera": (r) => r.status < 500,
  });

  if (!registerSuccess) {
    console.error(`Błąd rejestracji: ${response.status} - ${response.body}`);
  }

  sleep(2);
}
