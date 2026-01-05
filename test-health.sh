#!/bin/bash

echo "🧪 TESTING HEALTH ENDPOINT LOCALLY"
echo "=================================="

echo -e "\n1. Starting server in background..."
npm start &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"
echo "Waiting 5 seconds for server to start..."
sleep 5

echo -e "\n2. Testing health endpoint..."
echo "GET http://localhost:3000/health"
curl -v http://localhost:3000/health

echo -e "\n\n3. Testing with different methods..."
echo "HEAD request:"
curl -I http://localhost:3000/health

echo -e "\n4. Cleanup..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo -e "\n✅ Health endpoint test complete"