import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 500 },
    { duration: '1m', target: 3000 },
  ],
};

export default function () {
  
  const BASE_URL = 'http://nipa.sudlor.me/api';

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
