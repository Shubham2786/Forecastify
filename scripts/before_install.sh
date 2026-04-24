#!/bin/bash
set -e

echo "Starting before_install..."

# -----------------------------
# 1. Authenticate with ECR
# -----------------------------
echo "Logging into ECR..."

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)

aws ecr get-login-password --region $REGION \
| docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

echo "ECR login successful"

# -----------------------------
# 2. Clean old deployment
# -----------------------------
echo "Cleaning old application directory..."

rm -rf /home/ec2-user/forecastify
mkdir -p /home/ec2-user/forecastify

echo "Directory prepared"