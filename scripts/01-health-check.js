// 01-health-check.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

export let errorRate = new Rate('errors');
export let healthCheckLatency = new Trend('health_check_latency');
export let systemStatusLatency = new Trend('system_status_latency');
export let databaseCheckLatency = new Trend('database_check_latency');
export let requestCount = new Counter('http_reqs');

export let options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
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
  const healthCheckRes = retryRequest(() => http.get(`${BASE_URL}/health`));
  requestCount.add(1);
  healthCheckLatency.add(healthCheckRes.timings.duration);
  const ok = check(healthCheckRes, {
    'Health status 200': (r) => r.status === 200,
    'Health is healthy': (r) => r.json('status') === 'healthy',
  });
  errorRate.add(!ok);
  sleep(1);

  const systemRes = retryRequest(() => http.get(`${BASE_URL}/`));
  requestCount.add(1);
  systemStatusLatency.add(systemRes.timings.duration);
  const ok2 = check(systemRes, {
    'System 200': (r) => r.status === 200,
    'Correct message': (r) => r.json('message') === 'NIPA Travel API Server is running!',
  });
  errorRate.add(!ok2);
  sleep(1);

  const dbRes = retryRequest(() => http.get(`${BASE_URL}/check-tables`));
  requestCount.add(1);
  databaseCheckLatency.add(dbRes.timings.duration);
  const ok3 = check(dbRes, {
    'DB status 200': (r) => r.status === 200,
    'DB connected': (r) => r.json('message') === 'Database tables information',
  });
  errorRate.add(!ok3);
  sleep(1);
}