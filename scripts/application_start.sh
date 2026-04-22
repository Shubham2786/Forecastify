#!/bin/bash
set -e

cd /home/ec2-user/forecastify

echo "Fetching parameters from SSM..."
aws ssm get-parameters-by-path \
  --path "/forecastify/dev/" \
  --with-decryption \
  --region $REGION \
  --query "Parameters[*].[Name,Value]" \
  --output text | while read name value; do
    key=$(basename $name)
    echo "$key=$value" >> .env
done

# Login + pull + run
aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin 360121241545.dkr.ecr.eu-west-1.amazonaws.com
docker pull 360121241545.dkr.ecr.eu-west-1.amazonaws.com/forecastify-dev-repo:latest
docker-compose down || true
docker-compose up -d