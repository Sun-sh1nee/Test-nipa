# json_to_csv.py
import json
import csv
from collections import defaultdict
from datetime import datetime

# load data JSON lines
with open('output.json') as f:
    lines = [json.loads(line) for line in f if line.strip()]

# group metric what we need
latency_data = defaultdict(list)
error_count = defaultdict(int)
request_count = defaultdict(int)

# group by metric + time bucket
for point in lines:
    if point.get('type') != 'Point':
        continue

    metric = point.get('metric')
    time_str = point['data']['time']
    dt = datetime.fromisoformat(time_str.split('+')[0])  # remove timezone
    bucket = int(dt.timestamp() // 5) * 5  # group per 5s

    if metric == 'http_req_duration':
        latency_data[bucket].append(point['data']['value'])

    if metric == 'errors':
        if point['data']['value'] > 0:
            error_count[bucket] += 1

    if metric == 'http_reqs':
        request_count[bucket] += point['data']['value']

# เขียน CSV
with open('k6_metrics_summary.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=[
        'time_bucket_sec', 'avg_latency_ms', 'p99_latency_ms', 'rps', 'error_rate'
    ])
    writer.writeheader()

    for bucket in sorted(latency_data.keys()):
        data = latency_data[bucket]
        rps = request_count.get(bucket, 0) / 5
        errors = error_count.get(bucket, 0)
        total = request_count.get(bucket, 0)
        error_rate = (errors / total * 100) if total else 0

        writer.writerow({
            'time_bucket_sec': datetime.fromtimestamp(bucket).isoformat(),
            'avg_latency_ms': round(sum(data) / len(data), 2),
            'p99_latency_ms': round(quantiles(data, n=100)[98], 2) if len(data) >= 2 else data[0],
            'rps': round(rps, 2),
            'error_rate': round(error_rate, 2),
        })
