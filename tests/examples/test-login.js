import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  duration: "10s",
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.10"],
  },
};

const BASE_URL = "http://distributed.local";

const TEST_USER = {
  username: "Jan Kowalski",
  password: "Jankowalski123",
};

export default function () {
  const loginPayload = JSON.stringify({
    username: TEST_USER.username,
    password: TEST_USER.password,
  });

  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const loginResponse = http.post(
    `${BASE_URL}/api/user/login`,
    loginPayload,
    params
  );

  const loginSuccess = check(loginResponse, {
    "logowanie zwraca 200": (r) => r.status === 200,
    "odpowiedź zawiera token": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (loginSuccess) {
    const loginData = JSON.parse(loginResponse.body);
    const token = loginData.token;

    const authParams = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    };

    const profileResponse = http.get(`${BASE_URL}/api/user/me`, authParams);

    check(profileResponse, {
      "pobieranie profilu zwraca 200": (r) => r.status === 200,
      "odpowiedz zwraca username": (r) => {
        try {
          const body = JSON.parse(r.body);

          return body.username === TEST_USER.username;
        } catch {
          return false;
        }
      },
    });
  } else {
    console.log(`Logowanie failnęło: ${loginResponse.status}`);
  }

  sleep(2);
}
