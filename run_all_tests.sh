#!/bin/bash

INGRESS=$1

BASE_URL="http://nipa.sudlor.me/api"

mkdir -p results/$INGRESS/json

declare -a TESTS=("01-health-check" "02-error-handling" "03-data-fetch" "04-mixed-workload" "05-stress-test")

for TEST in "${TESTS[@]}"; do
  echo "▶ Running $TEST with BASE_URL=$BASE_URL ..."
  k6 run scripts/$TEST.js --out json=results/$INGRESS/json/${TEST}_json.json -e BASE_URL=$BASE_URL
  echo "⏳ Waiting 2 minutes before next test..."
  sleep 120
done

echo "✅ Done all tests for $INGRESS"
