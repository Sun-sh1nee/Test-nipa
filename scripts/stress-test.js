import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Custom Metrics
export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 100 },  
    { duration: '3m', target: 500 },  
    { duration: '5m', target: 3000 },
  ],
};

const BASE_URL = 'http://nipa.sudlor.me/api';
const headers = { 'Content-Type': 'application/json' };

export default function () {
  const username = `user_${randomString(8)}`;
  const email = `${username}@stress.com`;
  const password = 'test1234';

  // Register
  const regRes = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
    username,
    email,
    password,
    confirmPassword: password,
  }), { headers });

  const regOK = check(regRes, {
    'register: 201': (r) => r.status === 201,
  });
  errorRate.add(!regOK);
  if (!regOK) return;
  sleep(0.5);

  // Login
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    username,
    password,
  }), { headers });

  const loginOK = check(loginRes, {
    'login: 200': (r) => r.status === 200,
  });
  errorRate.add(!loginOK);
  if (!loginOK) return;

  const token = loginRes.json('data.token');
  const authHeaders = { ...headers, Authorization: `Bearer ${token}` };
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

  const createRes = http.post(`${BASE_URL}/bookings`, bookingPayload, { headers: authHeaders });
  const createOK = check(createRes, {
    'create: 201': (r) => r.status === 201,
  });
  errorRate.add(!createOK);
  if (!createOK) return;
  sleep(0.5);

  // Get Bookings
  const getRes = http.get(`${BASE_URL}/bookings`, { headers: authHeaders });
  const getOK = check(getRes, {
    'get: 200': (r) => r.status === 200,
  });
  errorRate.add(!getOK);
  sleep(0.5);

  // Delete Booking
  const bookingID = createRes.json('data.booking.id');
  const deleteOK = bookingID ? check(http.del(`${BASE_URL}/bookings/${bookingID}`, null, { headers: authHeaders }), {
    'delete: 200': (r) => r.status === 200,
  }) : false;
  errorRate.add(!deleteOK);
}
