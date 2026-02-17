#!/bin/bash
# Load env vars
export $(grep -v '^#' .env | xargs)

echo "Client ID: ${EXPO_PUBLIC_SPOTIFY_CLIENT_ID:0:5}..."

# 1. Get Token
AUTH=$(echo -n "$EXPO_PUBLIC_SPOTIFY_CLIENT_ID:$EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET" | base64)
RESPONSE=$(curl -s -X "POST" -H "Authorization: Basic $AUTH" -d grant_type=client_credentials https://accounts.spotify.com/api/token)

echo "Token Response: $RESPONSE"

TOKEN=$(echo $RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Failed to get token"
  exit 1
fi

echo "Got Token: ${TOKEN:0:10}..."

# 2. Search
echo "Searching..."
curl -v "https://api.spotify.com/v1/search?q=Muse&type=artist" -H "Authorization: Bearer $TOKEN"
