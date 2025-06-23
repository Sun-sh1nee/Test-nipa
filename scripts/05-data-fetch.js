import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { Trend } from 'k6/metrics';

// Define custom metrics
export let errorRate = new Rate('errors');
let fetchDuration = new Trend('fetch_duration');
// Load test configuration
export let options = {
  vus: 50, // number of virtual users
  duration: '1m', // test duration
  thresholds: {
    http_req_duration: ['p(95)<500' , 'p(99)<1000'], // 95% of requests < 500ms
    'errors': ['rate<0.05'], // < 5% error rate
    'fetch_duration': ['avg<800'], 
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
    // --------------------------
    // 1. Log In
    // --------------------------
    
    const username = 'admin';
    const password = 'password';
    const headers = { 'Content-Type': 'application/json' };
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

    if (!loginOK) return;
    
    const token = loginRes.json('data.token');
    const authHeaders = {
        ...headers,
        Authorization: `Bearer ${token}`,
    };
        sleep(1);
//----------------------------
// 2. Get large data booking
//----------------------------
const getBookingres = retryRequest(()=>
http.get(`${BASE_URL}/bookings/all` ,{headers: authHeaders }),3,200) ;

fetchDuration.add(getBookingres.timings.duration);

const getBookingOK = getBookingres && check(getBookingres, {
    'status is 200': (r) => r.status === 200,
    'accuracy of data': (r) => r.body && r.body.length > 0 && r.json('total_bookings') !== null ,
});

errorRate.add(!getBookingOK);
if(!getBookingOK) return ;

sleep(1);
}