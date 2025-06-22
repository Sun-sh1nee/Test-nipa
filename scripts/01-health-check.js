import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { Trend } from 'k6/metrics';

export let errorRate = new Rate('errors');
export let healthCheckLatency = new Trend('health_check_latency');
export let systemStatusLatency = new Trend('system_status_latency');
export let databaseCheckLatency = new Trend('database_check_latency');

export let options = {
  vus: 50, // number of virtual users
  duration: '1m', // test duration
  thresholds: {
    http_req_duration: ['p(95)<500' , 'p(99)<1000'], // 95% of requests < 500ms
    'errors': ['rate<0.05'], // < 5% error rate
  }
};

const BASE_URL =  'http://travel.local/api' ;

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

export default function() {
    // --------------------------
    // 1. Health Check
    // --------------------------
    
    const healthCheckRes = retryRequest(() =>
    http.get(`${BASE_URL}/health`), 3, 200);

    if (healthCheckRes) {
        healthCheckLatency.add(healthCheckRes.timings.duration / 1000) ;
    }
    
    const healthCheckOK = healthCheckRes && check(healthCheckRes , {
        'Health Check: status is 200': (r) => r.status === 200,
        'Health Check: healthy': (r) => r.body && r.body.length > 0 && (r.json('status') === 'healthy'),
    });

    errorRate.add(!healthCheckOK);
    if (!healthCheckOK) return;

    sleep(1) ;

    // --------------------------
    // 2. System Status Check
    // --------------------------

    const systemStatusRes = retryRequest(() =>
    http.get(`${BASE_URL}/`), 3, 200);

    if (systemStatusRes) {
        systemStatusLatency.add(systemStatusRes.timings.duration / 1000) ;
    }
    const systemStatusOK = systemStatusRes && check(systemStatusRes , {
        'System Status: status is 200': (r) => r.status === 200,
        'System Status: NIPA Travel API Server is running!': (r) => r.body && r.body.length > 0 && (r.json('message') === 'NIPA Travel API Server is running!'),
    });

    errorRate.add(!systemStatusOK);
    if (!systemStatusOK) return;

    sleep(1) ;

    // --------------------------
    // 3. Database Connection
    // --------------------------

    const databaseConnectionRes = retryRequest(() =>
    http.get(`${BASE_URL}/check-tables`), 3, 200);

    if (databaseConnectionRes) {
        databaseCheckLatency.add(databaseConnectionRes.timings.duration / 1000) ;
    }

    const databaseConnectionOK = databaseConnectionRes && check(databaseConnectionRes , {
        'Database Connection: status is 200': (r) => r.status === 200,
        'Database Connection: Database connected': (r) => r.body && r.body.length > 0 && (r.json('message') === 'Database tables information'),
    });

    errorRate.add(!databaseConnectionOK);
    if (!databaseConnectionOK) return;

    sleep(1) ;

}