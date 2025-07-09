// static-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom Metrics
export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 100 },  
    { duration: '3m', target: 500 },  
    { duration: '5m', target: 3000 },
  ],
};


export default function () {
  let res = http.get('http://nipa.sudlor.me/');

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  errorRate.add(!ok);
  sleep(0.5);
}

