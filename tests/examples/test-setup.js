import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.10"],
  },
};

const BASE_URL = "http://distributed.local";

export function setup() {
  console.log("Setup: Tworzenie użytkowników testowych...");

  const testUsers = [];

  for (let i = 0; i < 5; i++) {
    const username = `sutup_user_${Date.now()}_${i}`;
    const password = "TestPassword123";

    const payload = JSON.stringify({
      username: username,
      password: password,
    });

    const params = {
      headers: { "Content-Type": "application/json" },
    };

    const response = http.post(
      `${BASE_URL}/api/user/register`,
      payload,
      params
    );

    if (response.status === 200 || response.status === 201) {
      console.log(`✓ Utworzono użytkownika: ${username}`);
      testUsers.push({ username, password });
    } else {
      console.log(`✗ Nie udało się utworzyć użytkownika: ${username}`);
    }

    sleep(0.5);
  }

  return { users: testUsers };
}

export default function (data) {
  const user = data.users[__VU - 1];
  if (!user) {
    console.error(`Brak użytkownika dla VU ${__VU}`);
    return;
  }

  const loginPayload = JSON.stringify({
    username: user.username,
    password: user.password,
  });

  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const loginResponse = http.post(
    `${BASE_URL}/api/user/login`,
    loginPayload,
    params
  );

  check(loginResponse, {
    "Zalogowanie powiodło się": (r) => r.status === 200,
  });

  sleep(2);
}

export function teardown() {
  console.log("Teardown: Usuwanie użytkowników testowych...");
  console.log(`Test zakonczony! Użytkowników testowych: ${data.users.length}`);
}
