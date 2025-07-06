// 03-data-fetch.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

export let errorRate = new Rate('errors');
export let fetchDuration = new Trend('fetch_duration');
export let requestCount = new Counter('http_reqs');

export let options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '2m', target: 20 },
    { duration: '20s', target: 0 },
  ],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost/api';

function retryRequest(requestFunc, retries = 3, delay = 200) {
  for (let i = 0; i < retries; i++) {
    const res = requestFunc();
    if (res && res.status !== 0) return res;
    sleep(delay / 1000 * Math.pow(2, i));
  }
  return null;
}

export default function () {
  const loginRes = retryRequest(() => http.post(`${BASE_URL}/auth/login`, JSON.stringify({ username: 'admin', password: 'password' }), { headers: { 'Content-Type': 'application/json' } }));
  const ok = check(loginRes, {
    'Login 200': (r) => r.status === 200,
    'Token exists': (r) => r.json('data.token') !== undefined,
  });
  errorRate.add(!ok);
  if (!ok) return;

  const token = loginRes.json('data.token');
  const res = retryRequest(() => http.get(`${BASE_URL}/bookings/all`, { headers: { Authorization: `Bearer ${token}` } }));
  requestCount.add(1);
  fetchDuration.add(res.timings.duration);
  const dataOK = check(res, {
    'Fetch 200': (r) => r.status === 200,
    'Total bookings ≥ 1000': (r) => {
      const total = r.json('data.total_bookings');
      return total !== undefined && total >= 1000;
    },
  });
  errorRate.add(!dataOK);
  sleep(1);
}
