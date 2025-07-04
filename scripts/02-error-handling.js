// 02-error-handling.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

export let errorRate = new Rate('errors');
export let notFoundLatency = new Trend('latency_404');
export let requestCount = new Counter('http_reqs');

export let options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '20s', target: 0 },
  ],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost/api';

export default function () {
  const notFound = http.get(`${BASE_URL}/invalid-endpoint`);
  requestCount.add(1);
  notFoundLatency.add(notFound.timings.duration);
  const failCheck = check(notFound, {
    '404 received': (r) => r.status === 404,
  });
  errorRate.add(failCheck);
  sleep(1);
}