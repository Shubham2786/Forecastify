#!/bin/bash
set -e

cd /home/ec2-user/forecastify

# Fetch secrets from SSM
export NEXT_PUBLIC_SUPABASE_URL=$(aws ssm get-parameter --name "/forecastify/dev/NEXT_PUBLIC_SUPABASE_URL" --with-decryption --query "Parameter.Value" --output text)
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(aws ssm get-parameter --name "/forecastify/dev/NEXT_PUBLIC_SUPABASE_ANON_KEY" --with-decryption --query "Parameter.Value" --output text)
export OPENWEATHER_API_KEY=$(aws ssm get-parameter --name "/forecastify/dev/OPENWEATHER_API_KEY" --with-decryption --query "Parameter.Value" --output text)
export GROQ_API_KEY=$(aws ssm get-parameter --name "/forecastify/dev/GROQ_API_KEY" --with-decryption --query "Parameter.Value" --output text)
export GROQ_API_KEY_2=$(aws ssm get-parameter --name "/forecastify/dev/GROQ_API_KEY_2" --with-decryption --query "Parameter.Value" --output text)
export GROQ_API_KEY_3=$(aws ssm get-parameter --name "/forecastify/dev/GROQ_API_KEY_3" --with-decryption --query "Parameter.Value" --output text)
export SERPER_API_KEY=$(aws ssm get-parameter --name "/forecastify/dev/SERPER_API_KEY" --with-decryption --query "Parameter.Value" --output text)
export GOOGLE_MAPS_API_KEY=$(aws ssm get-parameter --name "/forecastify/dev/GOOGLE_MAPS_API_KEY" --with-decryption --query "Parameter.Value" --output text)

# Login + pull + run
aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin 360121241545.dkr.ecr.eu-west-1.amazonaws.com
docker pull 360121241545.dkr.ecr.eu-west-1.amazonaws.com/forecastify:latest
docker-compose down || true
docker-compose up -d