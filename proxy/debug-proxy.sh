#!/bin/bash
# Kill existing proxy on port 8082
PID=$(lsof -t -i:8082)
if [ -n "$PID" ]; then
  kill -9 $PID
fi

# Start proxy and redirect logs to file
node proxy.js > debug.log 2>&1 &
echo "Started Proxy PID $!"

# Wait for startup
sleep 3

# Test Curl
echo "Testing curl..."
curl -v "http://localhost:8082/spotify/search?q=Muse" >> debug.log 2>&1

echo "Done."
