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
export function setup() {
  console.log("Setup: Tworzenie użytkowników testowych...");

  const testUsers = [];
  return { users: testUsers };
}

export default function (data) {
  const user = data.users[__VU - 1];

  for (let i = 1; i <= 10; i++) {}
  if (!user) {
    console.error(`Brak użytkownika dla VU ${__VU}`);
    return;
  }
}

export function teardown(data) {
  console.log("Teardown: Usuwanie użytkowników testowych...");
  console.log(`Test zakonczony! Użytkowników testowych: ${data.users.length}`);
}
