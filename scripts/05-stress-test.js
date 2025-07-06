// 05-stress-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Custom Metrics
export let errorRate = new Rate('errors');
export let loginLatency = new Trend('login_latency');
export let createBookingLatency = new Trend('create_booking_latency');
export let getBookingLatency = new Trend('get_booking_latency');

export let options = {
  stages: [
    { duration: '5m', target: 50 },    // ramp-up to 50 users in 5 min
    { duration: '5m', target: 100 },   // ramp-up to 100 users in next 5 min
    { duration: '10m', target: 200 },  // stay at 200 users for 10 min
    { duration: '5m', target: 100 },   // ramp-down to 100 users
    { duration: '5m', target: 0 },     // ramp-down to 0
  ],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost/api';
const headers = { 'Content-Type': 'application/json' };

function retryRequest(requestFunc, retries = 3, delay = 200) {
  for (let i = 0; i < retries; i++) {
    const res = requestFunc();
    if (res && res.status !== 0) return res;
    sleep(delay / 1000 * Math.pow(2, i));
  }
  return null;
}

export default function () {
  const username = `user_${randomString(8)}`;
  const email = `${username}@stress.com`;
  const password = 'test1234';

  // Register
  const regRes = retryRequest(() => http.post(`${BASE_URL}/auth/register`, JSON.stringify({ username, email, password, confirmPassword: password }), { headers }));
  const regOK = regRes && check(regRes, {
    'register: 201': (r) => r.status === 201,
  });
  errorRate.add(!regOK);
  if (!regOK) return;
  sleep(0.5);

  // Login
  const loginRes = retryRequest(() => http.post(`${BASE_URL}/auth/login`, JSON.stringify({ username, password }), { headers }));
  if (loginRes) loginLatency.add(loginRes.timings.duration / 1000);
  const token = loginRes.json('data.token');
  const authHeaders = { ...headers, Authorization: `Bearer ${token}` };
  const loginOK = loginRes && check(loginRes, {
    'login: 200': (r) => r.status === 200,
  });
  errorRate.add(!loginOK);
  if (!loginOK) return;
  sleep(0.5);

  // Create Booking
  const bookingPayload = JSON.stringify({
    departure_location: 'Bangkok',
    destination_location: 'Phuket',
    departure_latitude: 13.75,
    departure_longitude: 100.50,
    destination_latitude: 7.88,
    destination_longitude: 98.38,
    flight_number: 'ST9999',
    departure_date: '2025-12-31',
    departure_time: '10:00:00',
    arrival_date: '2025-12-31',
    arrival_time: '12:00:00',
    seat_number: '12A',
    gate_number: 'G5',
    ticket_price: 1999.99,
  });

  const createRes = retryRequest(() => http.post(`${BASE_URL}/bookings`, bookingPayload, { headers: authHeaders }));
  if (createRes) createBookingLatency.add(createRes.timings.duration / 1000);
  const createOK = createRes && check(createRes, {
    'create: 201': (r) => r.status === 201,
  });
  errorRate.add(!createOK);
  sleep(0.5);

  // Delete Booking after create
  const delRes = http.del(`${BASE_URL}/bookings/${bookingID}`, null, { headers: authHeaders });
  const deleteOK = check(delRes, { 'delete: 200': (r) => r.status === 200 });
  errorRate.add(!deleteOK);
}
