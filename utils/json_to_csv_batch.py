import os
import json
import csv
import sys
from statistics import quantiles
from collections import defaultdict
from datetime import datetime

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RESULT_DIR = os.path.join(ROOT_DIR, 'results')

VALID_INGRESS = ['nginx', 'traefik', 'haproxy', 'apisix']
arg = sys.argv[1] if len(sys.argv) > 1 else 'all'
IMPLEMENTATIONS = VALID_INGRESS if arg == 'all' else [arg]

if not set(IMPLEMENTATIONS).issubset(set(VALID_INGRESS)):
    print(f"❌ Invalid ingress: {arg}")
    sys.exit(1)

LATENCY_METRICS = ['http_req_duration', 'static_latency']

for impl in IMPLEMENTATIONS:
    json_dir = os.path.join(RESULT_DIR, impl, 'json')
    csv_dir = os.path.join(RESULT_DIR, impl, 'csv')
    os.makedirs(csv_dir, exist_ok=True)

    print(f"📁 Processing ingress: {impl}")

    for fname in os.listdir(json_dir):
        if not fname.endswith('.json'):
            continue

        filepath = os.path.join(json_dir, fname)
        outname = fname.replace('_json.json', '_csv.csv')
        outpath = os.path.join(csv_dir, outname)

        latency_data = defaultdict(list)
        error_sum = defaultdict(float)
        request_count = defaultdict(int)

        line_count = 0

        try:
            with open(filepath) as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        point = json.loads(line)
                        line_count += 1
                    except Exception:
                        print(f"⚠️  Skipped invalid JSON in {fname}")
                        continue

                    if point.get('type') != 'Point':
                        continue

                    metric = point.get('metric')
                    try:
                        time_str = point['data']['time']
                        dt = datetime.fromisoformat(time_str.split('+')[0])
                        bucket = int(dt.timestamp() // 5) * 5
                    except Exception:
                        continue

                    if metric in LATENCY_METRICS:
                        latency_data[bucket].append(point['data']['value'])

                    if metric == 'errors':
                        error_sum[bucket] += point['data']['value']

                    if metric == 'http_reqs':
                        request_count[bucket] += point['data']['value']
        except FileNotFoundError:
            print(f"❌ File not found: {filepath}")
            continue

        if not latency_data:
            print(f"⚠️  No latency data found in {fname}")
            continue

        with open(outpath, 'w', newline='') as out:
            writer = csv.DictWriter(out, fieldnames=[
                'time_bucket_sec', 'avg_latency_ms', 'p99_latency_ms', 'rps', 'error_rate'
            ])
            writer.writeheader()

            for bucket in sorted(latency_data.keys()):
                data = latency_data[bucket]
                rps = request_count.get(bucket, 0) / 5
                total_reqs = request_count.get(bucket, 0)
                error_avg = error_sum.get(bucket, 0)
                
                # ✅ แก้ไขการคำนวณ error rate ให้ถูกต้อง (0-100%)
                error_rate = round((error_avg / total_reqs * 100) if total_reqs > 0 else 0.0, 2)

                writer.writerow({
                    'time_bucket_sec': datetime.fromtimestamp(bucket).isoformat(),
                    'avg_latency_ms': round(sum(data) / len(data), 2),
                    'p99_latency_ms': round(quantiles(data, n=100)[98], 2) if len(data) >= 2 else data[0],
                    'rps': round(rps, 2),
                    'error_rate': error_rate,
                })

        print(f"✅ Generated: {outpath} ({line_count} lines)")
