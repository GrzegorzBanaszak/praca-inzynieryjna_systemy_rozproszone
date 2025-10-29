import http from "k6/http";
import { check, sleep } from "k6";

const URL = "http://distributed.local";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.05"],
    checks: ["rate>0.99"],
  },
};

export default function () {
  const respons = http.get(`${URL}/healthz`);

  check(respons, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
    "response has body": (r) => r.body.includes("Healthy"),
  });

  sleep(1);
}
