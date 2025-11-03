import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  duration: "10s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.05"],
    checks: ["rate>0.99"],
  },
};
const BASE_URL = __ENV.API_GATEWAY_URL || "http://distributed.local";
const PRODUCT_ENDPOINT = `${BASE_URL}/api/product`;

export default function () {
  const respons = http.get(PRODUCT_ENDPOINT);

  const data = JSON.parse(respons.body.length);

  console.log(data);
  check(respons, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
    "response has body": (r) => r.body.includes("Healthy"),
  });

  sleep(1);
}
