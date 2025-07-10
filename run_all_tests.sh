#!/bin/bash

INGRESS=$1
ROUNDS=${2:-1}  # จำนวนรอบ (default=1 ถ้าไม่ใส่)

mkdir -p results/$INGRESS/json

declare -a TESTS=("static-test" "stress-test")

for (( round=1; round<=ROUNDS; round++ ))
do
  echo "🔄 Starting round $round of $ROUNDS for Ingress: $INGRESS"

  for TEST in "${TESTS[@]}"; do
    echo "▶ Running $TEST .. Ingress: $INGRESS (Round $round)"
    k6 run scripts/$TEST.js --out json=results/$INGRESS/json/${TEST}_json_round${round}_json.json
    echo "⏳ Waiting 60 seconds before next test..."
    sleep 60
  done

done

echo "✅ Done all $ROUNDS rounds of tests for $INGRESS"
