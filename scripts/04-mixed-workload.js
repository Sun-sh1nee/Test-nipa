// 04-mixed-workload.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Custom Metrics
export let errorRate = new Rate('errors');
export let loginLatency = new Trend('login_latency');
export let createBookingLatency = new Trend('create_booking_latency');
export let updateBookingLatency = new Trend('update_booking_latency');
export let getBookingLatency = new Trend('get_booking_latency');
export let getBookingIDLatency = new Trend('get_booking_id_latency');
export let deleteBookingLatency = new Trend('delete_booking_latency');
export let logoutLatency = new Trend('logout_latency');

export let options = {
  vus: 50,
  duration: '1m',
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

function generateRandomBooking() {
  const randomLetters = () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 26)) + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 26));
  const randomDigits = () => String(Math.floor(100 + Math.random() * 900));
  const randomFutureDate = () => {
    const now = new Date();
    const future = new Date(now.getTime() + Math.floor(Math.random() * 7) * 86400000);
    return future.toISOString().split('T')[0];
  };
  const randomDepartureTime = () => {
    const hour = Math.floor(6 + Math.random() * 14);
    const minute = Math.floor(Math.random() * 60);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  };
  const calculateArrival = (date, time) => {
    const [h, m] = time.split(':').map(Number);
    const dep = new Date(`${date}T${time}`);
    const arr = new Date(dep.getTime() + 2 * 3600000);
    return {
      arrivalDate: arr.toISOString().split('T')[0],
      arrivalTime: `${String(arr.getHours()).padStart(2, '0')}:${String(arr.getMinutes()).padStart(2, '0')}:00`
    };
  };
  const randomSeatNumber = () => `${Math.floor(1 + Math.random() * 99)}${'ABCDEF'.charAt(Math.floor(Math.random() * 6))}`;
  const randomGateNumber = () => `${'ABCDEFGH'.charAt(Math.floor(Math.random() * 8))}${Math.floor(1 + Math.random() * 20)}`;

  const departure_date = randomFutureDate();
  const departure_time = randomDepartureTime();
  const { arrivalDate, arrivalTime } = calculateArrival(departure_date, departure_time);

  return {
    departure_location: 'Bangkok (BKK)',
    destination_location: 'Chiang Mai (CNX)',
    departure_latitude: 13.7563,
    departure_longitude: 100.5018,
    destination_latitude: 18.7669,
    destination_longitude: 98.962,
    flight_number: randomLetters() + randomDigits(),
    departure_date,
    departure_time,
    arrival_date: arrivalDate,
    arrival_time: arrivalTime,
    seat_number: randomSeatNumber(),
    gate_number: randomGateNumber(),
    ticket_price: 2500.00,
  };
}

function normalizeValue(value) {
  if (typeof value === 'number' || (!isNaN(parseFloat(value)) && isFinite(value))) return parseFloat(value).toFixed(2);
  if (typeof value === 'string') {
    if (value.includes('T') && value.includes('Z')) return value.split('T')[0];
    if (value.match(/^\d{2}:\d{2}(:\d{2})?$/)) return value.substring(0, 5);
  }
  return value;
}

function isBookingDataEqual(expected, actual) {
  if (!actual) return false;
  return [
    'departure_location','destination_location','departure_latitude','departure_longitude',
    'destination_latitude','destination_longitude','flight_number','departure_date','departure_time',
    'arrival_date','arrival_time','seat_number','gate_number','ticket_price'
  ].every(key => normalizeValue(expected[key]) === normalizeValue(actual[key]));
}

export default function () {
  const username = `user_${randomString(8)}`;
  const email = `${username}@test.com`;
  const password = 'test1234';
  const headers = { 'Content-Type': 'application/json' };

  // Register
  const regRes = retryRequest(() => http.post(`${BASE_URL}/auth/register`, JSON.stringify({ username, email, password, confirmPassword: password }), { headers }));
  const regOK = regRes && check(regRes, {
    'register: status is 201': (r) => r.status === 201,
    'register: user ID exists': (r) => r.json('data.user.id') !== undefined,
  });
  errorRate.add(!regOK);
  if (!regOK) return;
  sleep(1);

  // Login
  const loginRes = retryRequest(() => http.post(`${BASE_URL}/auth/login`, JSON.stringify({ username, password }), { headers }));
  if (loginRes) loginLatency.add(loginRes.timings.duration / 1000);
  const loginOK = loginRes && check(loginRes, {
    'login: status is 200': (r) => r.status === 200,
    'login: token exists': (r) => r.json('data.token') !== undefined,
  });
  errorRate.add(!loginOK);
  if (!loginOK) return;
  const token = loginRes.json('data.token');
  const authHeaders = { ...headers, Authorization: `Bearer ${token}` };
  sleep(1);

  // Create
  const bookingData = generateRandomBooking();
  const createBookingRes = retryRequest(() => http.post(`${BASE_URL}/bookings`, JSON.stringify(bookingData), { headers: authHeaders }));
  if (createBookingRes) createBookingLatency.add(createBookingRes.timings.duration / 1000);
  const createdBooking = createBookingRes.json('data.booking');
  const createBookingOK = check(createBookingRes, {
    'Create Booking: status is 201': (r) => r.status === 201,
    'Create Booking: success': (r) => r.json('success') === true,
    'Create Booking: accuracy': () => isBookingDataEqual(bookingData, createdBooking),
  });
  errorRate.add(!createBookingOK);
  const bookingID = createBookingRes.json('data.booking.id');
  sleep(1);

  // Update
  const updateData = generateRandomBooking();
  const updateBookingRes = retryRequest(() => http.put(`${BASE_URL}/bookings/${bookingID}`, JSON.stringify(updateData), { headers: authHeaders }));
  if (updateBookingRes) updateBookingLatency.add(updateBookingRes.timings.duration / 1000);
  const updatedBooking = updateBookingRes.json('data.booking');
  const updateOK = check(updateBookingRes, {
    'Update Booking: status is 200': (r) => r.status === 200,
    'Update Booking: accuracy': () => isBookingDataEqual(updateData, updatedBooking),
  });
  errorRate.add(!updateOK);
  sleep(1);

  // Get All
  const getRes = retryRequest(() => http.get(`${BASE_URL}/bookings`, { headers: authHeaders }));
  if (getRes) getBookingLatency.add(getRes.timings.duration / 1000);
  const getOK = check(getRes, {
    'Get Booking: status is 200': (r) => r.status === 200,
  });
  errorRate.add(!getOK);
  sleep(1);

  // Get by ID
  const getIDRes = retryRequest(() => http.get(`${BASE_URL}/bookings/${bookingID}`, { headers: authHeaders }));
  if (getIDRes) getBookingIDLatency.add(getIDRes.timings.duration / 1000);
  const getIDOK = check(getIDRes, {
    'Get Booking ID: status is 200': (r) => r.status === 200,
    'Booking ID match': (r) => r.json('data.booking.id') === bookingID,
  });
  errorRate.add(!getIDOK);
  sleep(1);

  // Delete
  const deleteRes = retryRequest(() => http.del(`${BASE_URL}/bookings/${bookingID}`, null, { headers: authHeaders }));
  if (deleteRes) deleteBookingLatency.add(deleteRes.timings.duration / 1000);
  const deleteOK = check(deleteRes, {
    'Delete Booking: status is 200': (r) => r.status === 200,
    'Delete Booking: match': (r) => r.json('data.deleted_booking_id') === `${bookingID}`,
  });
  errorRate.add(!deleteOK);
  sleep(1);

  // Logout
  const logoutRes = retryRequest(() => http.post(`${BASE_URL}/auth/logout`, null, { headers: authHeaders }));
  if (logoutRes) logoutLatency.add(logoutRes.timings.duration / 1000);
  const logoutOK = check(logoutRes, {
    'logout : status is 200': (r) => r.status === 200,
  });
  errorRate.add(!logoutOK);
  sleep(1);
}
