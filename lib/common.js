// lib/common.js
import { SharedArray, csv } from 'k6/data';
import http from 'k6/http';
import { check, sleep } from 'k6';

// Base URL for the application, will be set via --env BASE_URL
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Function to generate random string for unique usernames
export function makeid(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// Function to register a new user
export function registerUser(username, password) {
  const registerRes = http.post(`${BASE_URL}/api/auth/register`, {
    username: username,
    email: `${username}@example.com`,
    password: password,
    confirmPassword: password,
  }, {
    tags: { name: 'registerUser' },
    headers: { 'Content-Type': 'application/json' },
  });

  check(registerRes, {
    'register status is 200': (r) => r.status === 200,
    'register success is true': (r) => r.json().success === true,
  });

  return registerRes;
}

// Function to login a user and return JWT token
export function loginUser(username, password) {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
    username: username,
    password: password,
  }, {
    tags: { name: 'loginUser' },
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login success is true': (r) => r.json().success === true,
    'login has token': (r) => r.json().data && r.json().data.token !== undefined,
  });

  if (loginRes.json().data && loginRes.json().data.token) {
    return loginRes.json().data.token;
  }
  return null;
}

// Function to get user profile
export function getProfile(token) {
  const profileRes = http.get(`${BASE_URL}/api/auth/profile`, {
    tags: { name: 'getProfile' },
    headers: { 'Authorization': `Bearer ${token}` },
  });

  check(profileRes, {
    'getProfile status is 200': (r) => r.status === 200,
    'getProfile success is true': (r) => r.json().success === true,
  });

  return profileRes;
}

// Function to create a booking
export function createBooking(token) {
  const payload = JSON.stringify({
    departure_location: `CityA_${makeid(5)}`,
    destination_location: `CityB_${makeid(5)}`,
    departure_latitude: 13.7563,
    departure_longitude: 100.5018,
    destination_latitude: 7.8804,
    destination_longitude: 98.3923,
    flight_number: `FL${Math.floor(Math.random() * 1000)}`,
    departure_date: '2025-12-25',
    departure_time: '10:00',
    arrival_date: '2025-12-25',
    arrival_time: '12:00',
    seat_number: `A${Math.floor(Math.random() * 50)}`,
    gate_number: `G${Math.floor(Math.random() * 10)}`,
    ticket_price: parseFloat((Math.random() * 500).toFixed(2)) + 100,
  });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const res = http.post(`${BASE_URL}/api/bookings`, payload, {
    tags: { name: 'createBooking' },
    headers: headers,
  });

  check(res, {
    'create booking status is 200': (r) => r.status === 200,
    'create booking success is true': (r) => r.json().success === true,
    'booking id exists': (r) => r.json().data && r.json().data.booking_id,
  });

  return res;
}

// Function to get all bookings for a user
export function getBookings(token) {
  const res = http.get(`${BASE_URL}/api/bookings`, {
    tags: { name: 'getBookings' },
    headers: { 'Authorization': `Bearer ${token}` },
  });

  check(res, {
    'get bookings status is 200': (r) => r.status === 200,
    'get bookings success is true': (r) => r.json().success === true,
  });

  return res;
}

// Function to get a single booking
export function getBookingById(token, bookingId) {
  const res = http.get(`${BASE_URL}/api/bookings/${bookingId}`, {
    tags: { name: 'getBookingById' },
    headers: { 'Authorization': `Bearer ${token}` },
  });

  check(res, {
    'get booking by id status is 200': (r) => r.status === 200,
    'get booking by id success is true': (r) => r.json().success === true,
  });

  return res;
}

// Function to update a booking
export function updateBooking(token, bookingId) {
  const payload = JSON.stringify({
    destination_location: `UpdatedCity_${makeid(5)}`,
    ticket_price: parseFloat((Math.random() * 600).toFixed(2)) + 150,
  });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const res = http.put(`${BASE_URL}/api/bookings/${bookingId}`, payload, {
    tags: { name: 'updateBooking' },
    headers: headers,
  });

  check(res, {
    'update booking status is 200': (r) => r.status === 200,
    'update booking success is true': (r) => r.json().success === true,
  });

  return res;
}

// Function to delete a booking
export function deleteBooking(token, bookingId) {
  const res = http.del(`${BASE_URL}/api/bookings/${bookingId}`, null, {
    tags: { name: 'deleteBooking' },
    headers: { 'Authorization': `Bearer ${token}` },
  });

  check(res, {
    'delete booking status is 200': (r) => r.status === 200,
    'delete booking success is true': (r) => r.json().success === true,
  });

  return res;
}

// Load user data from CSV for shared use across VUs
export const users = new SharedArray('users', function () {
  return csv.parse(open('../data/users.csv'), { header: true }).map(user => ({
    username: user.username,
    password: user.password
  }));
});