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
  let res = http.get('http://nipa.sudlor.me/');

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(0.5);
}

