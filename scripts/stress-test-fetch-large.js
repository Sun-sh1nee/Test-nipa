// stress-test2.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

const BASE_URL = 'http://nipa.sudlor.me/api';
const headers = { 'Content-Type': 'application/json' };

export let options = {
  stages: [
    { duration: '1m', target: 100 },    // Warm-up
    { duration: '2m', target: 300 },    // Normal load ramp-up
    { duration: '5m', target: 1000 },   // Ramp-up high load
    { duration: '1m', target: 1000 },   // Steady high load
    { duration: '1m', target: 0 },      // Ramp-down
  ],
};

// ฟังก์ชัน setup() จะรันแค่ครั้งเดียวก่อนเริ่มทดสอบ เพื่อ login และเก็บ token
export function setup() {
  let token = null;
  const retries = 3;
  const delay = 1;

  for (let i = 0; i < retries; i++) {
    const res = http.post(`${BASE_URL}/auth/login`,
      JSON.stringify({ username: 'admin', password: 'password' }),
      { headers }
    );

    if (res && res.status === 200) {
      try {
        token = res.json('data.token');
        if (token) break;
      } catch (e) {
        console.warn(`❌ Failed to parse login response on attempt ${i + 1}`);
      }
    } else {
      console.warn(`⚠️ Login request failed [attempt ${i + 1}]`);
    }

    sleep(delay);
  }

  if (!token) {
    throw new Error('Login failed in setup(), aborting test');
  }
  return { token };
}

export default function (data) {
  const authHeaders = { ...headers, Authorization: `Bearer ${data.token}` };

  const res = http.get(`${BASE_URL}/bookings/all?limit=500`, { headers: authHeaders });

  let bookingsCount = 0;
  if (res && res.status === 200 && res.body) {
    try {
      const bookings = res.json('data.bookings');
      bookingsCount = bookings ? bookings.length : 0;
    } catch (e) {
      console.warn('❌ Failed to parse bookings response');
    }
  }

  const dataOK = check(res, {
    'Fetch 200': (r) => r.status === 200,
    'Total bookings ≥ 500': () => bookingsCount >= 500,
  });

  errorRate.add(!dataOK);

  sleep(1);
}
