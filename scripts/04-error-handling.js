import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 5,
  duration: '10s',
};

const BASE_URL = 'http://cuintern.com';

function randomInvalidPath() {
  const words = ['foo', 'bar', 'baz', 'test', 'invalid', 'missing', 'ghost', 'fake'];
  const suffix = Math.floor(Math.random() * 1000);
  const word = words[Math.floor(Math.random() * words.length)];
  return `/api/${word}-${suffix}`;
}

export default function () {
  const invalidPath = randomInvalidPath();
  const res = http.get(`${BASE_URL}${invalidPath}`);
  
  check(res, {
    [`404: status is 404`]: (r) => r.status === 404,
    [`404: Route not found`]: (r) => r.json('message') === 'Route not found',
  });
}
