// stress-test2.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

export let errorRate = new Rate('errors');
export let fetchDuration = new Trend('fetch_duration');
export let requestCount = new Counter('http_reqs');

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '3m', target: 500 },
    { duration: '5m', target: 1500 },
  ],
};

const BASE_URL = 'http://nipa.sudlor.me/api';
const headers = { 'Content-Type': 'application/json' };

export default function () {
  // 🔐 Login
  const loginRes = http.post(`${BASE_URL}/auth/login`,
    JSON.stringify({ username: 'admin', password: 'password' }),
    { headers }
  );

  const ok = check(loginRes, {
    'Login 200': (r) => r.status === 200,
    'Token exists': (r) => r.json('data.token') !== undefined,
  });
  errorRate.add(!ok);
  if (!ok) return;

  const token = loginRes.json('data.token');
  const authHeaders = { ...headers, Authorization: `Bearer ${token}` };

  // 📥 Fetch bookings
  const res = http.get(`${BASE_URL}/bookings/all?limit=500`, { headers: authHeaders });
  requestCount.add(1);
  fetchDuration.add(res.timings.duration);

  const dataOK = check(res, {
    'Fetch 200': (r) => r.status === 200,
    'Total bookings ≥ 500': (r) => {
      const bookingsCount = r.json('data.bookings').length;
      return bookingsCount !== undefined && bookingsCount >= 500;
    },
  });
  errorRate.add(!dataOK);

  sleep(1);
}
