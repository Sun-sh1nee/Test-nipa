// scripts/01-health-check.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../lib/common.js';

export const options = {
  stages: [
    { duration: '1m', target: 5 },   // Ramp-up to 5 VUs over 1 minute
    { duration: '2m', target: 5 },   // Stay at 5 VUs for 2 minutes
    { duration: '30s', target: 0 },  // Ramp-down to 0 VUs over 30 seconds
  ],
  thresholds: {
    'http_req_duration{name:healthCheck}': ['p(95)<70'], // 95th percentile should be < 70ms
    'http_req_duration{name:systemStatus}': ['p(95)<150'], // 95th percentile should be < 150ms
    'http_req_duration{name:dbCheck}': ['p(95)<300'],   // 95th percentile should be < 300ms
    'http_req_failed': ['rate<0.01'], // error rate should be less than 1%
  },
};

export default function () {
  // Test GET /health
  const healthRes = http.get(`${BASE_URL}/health`, {
    tags: { name: 'healthCheck' },
  });
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check message': (r) => r.body.includes('OK'),
  });
  sleep(0.5); // Short pause

  // Test GET /
  const rootRes = http.get(`${BASE_URL}/`, {
    tags: { name: 'systemStatus' },
  });
  check(rootRes, {
    'root status is 200': (r) => r.status === 200,
    'root message': (r) => r.body.includes('API is running'),
  });
  sleep(0.5); // Short pause

  // Test GET /api/check-tables (assuming this exists or modify to your DB check API)
  const dbCheckRes = http.get(`${BASE_URL}/api/check-tables`, { // Assuming this is your DB check endpoint from server.js
    tags: { name: 'dbCheck' },
  });
  check(dbCheckRes, {
    'db check status is 200': (r) => r.status === 200,
    'db check success': (r) => r.json().success === true,
  });
  sleep(1);
}