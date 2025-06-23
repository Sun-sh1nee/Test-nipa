import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Define custom metrics
export let errorRate = new Rate('errors');

// Load test configuration
export let options = {
  vus: 50, // number of virtual users
  duration: '1m', // test duration
  thresholds: {
    http_req_duration: ['p(95)<500' , 'p(99)<1000'], // 95% of requests < 500ms
    'errors': ['rate<0.05'], // < 5% error rate
  }
};

// Ingress-exposed base URL
const BASE_URL =  'http://cuintern.com/api'

// Helper: Retry a request function up to `retries` times with exponential backoff
function retryRequest(requestFunc, retries = 3, initialDelayMs = 200) {
  for (let i = 0; i < retries; i++) {
    const res = requestFunc();
    if (res && res.status !== 0) {
      return res;
    }
    sleep(initialDelayMs / 1000 * Math.pow(2, i)); // Exponential backoff sleep
  }
  return null;
}

// Test lifecycle
export default function () {
  // Randomized user data
  const username = `user_${randomString(8)}`;
  const email = `${username}@test.com`;
  const password = 'test1234';

  // --------------------------
  // 1. Register
  // --------------------------
  const registerPayload = JSON.stringify({
    username,
    email,
    password,
    confirmPassword: password
  });

  const headers = { 'Content-Type': 'application/json' };

  const regRes = retryRequest(() =>
    http.post(`${BASE_URL}/auth/register`, registerPayload, { headers }), 3, 200);

  const regOK = regRes && check(regRes, {
    'register: status is 201': (r) => r.status === 201,
    'register: has body': (r) => r.body && r.body.length > 0,
    'register: user ID exists': (r) => {
      if (r.status !== 201 || !r.body) return false;
      try {
        return r.json('data.user.id') !== undefined;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!regOK);
  if (!regOK) return;

  sleep(1); // simulate user delay

  // --------------------------
  // 2. Login
  // --------------------------
  const loginPayload = JSON.stringify({
    username,
    password
  });

  const loginRes = retryRequest(() =>
    http.post(`${BASE_URL}/auth/login`, loginPayload, { headers }), 3, 200);

  const loginOK = loginRes && check(loginRes, {
    'login: status is 200': (r) => r.status === 200,
    'login: has body': (r) => r.body && r.body.length > 0,
    'login: token exists': (r) => {
      if (r.status !== 200 || !r.body) return false;
      try {
        return r.json('data.token') !== undefined;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!loginOK);
  if (!loginOK) return;

  const token = loginRes.json('data.token');
  const authHeaders = {
    ...headers,
    Authorization: `Bearer ${token}`,
  };

  sleep(1);

  // --------------------------
  // 3. Get Profile
  // --------------------------
  const profileRes = retryRequest(() =>
    http.get(`${BASE_URL}/auth/profile`, { headers: authHeaders }), 3, 200);

  const profileOK = profileRes && check(profileRes, {
    'profile: status is 200': (r) => r.status === 200,
    'profile: user data present': (r) => r.json('data.user.email') === email,
  });

  errorRate.add(!profileOK);

  sleep(1);

  //----------------------------
  // 4. Log out
  //----------------------------
  const logoutRes = retryRequest(() =>
    http.post(`${BASE_URL}/auth/logout` ,null, {headers: authHeaders}),3,200) ;

  const logoutOK = logoutRes && check(logoutRes, {
    'logout : status is 200': (r) => r.status === 200 ,
  });

  errorRate.add(!logoutOK);
  sleep(1);
}