#!/bin/bash
set -e

cd /home/ec2-user/forecastify

echo "Starting application_start..."

# -----------------------------
# 1. Set REGION (IMPORTANT)
# -----------------------------
REGION="eu-west-1"

# -----------------------------
# 2. Fetch parameters from SSM
# -----------------------------
echo "Fetching parameters from SSM..."

rm -f .env   # prevent duplicates

aws ssm get-parameters-by-path \
  --path "/forecastify/dev/" \
  --with-decryption \
  --region $REGION \
  --query "Parameters[*].[Name,Value]" \
  --output text | while read name value; do
    key=$(basename $name)
    echo "$key=$value" >> .env
done

echo ".env file created"

# -----------------------------
# 3. Restart containers properly
# -----------------------------
echo "Stopping old containers..."
docker-compose down || true

echo "Pulling latest image..."
docker-compose pull

echo "Starting containers..."
docker-compose up -d --force-recreate

echo "Deployment completed successfully"