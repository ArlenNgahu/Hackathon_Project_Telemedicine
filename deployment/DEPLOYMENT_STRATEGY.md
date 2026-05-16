
# DEPLOYMENT STRATEGY
## Quadriplegic Telemedicine Platform

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION DEPLOYMENT                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         AWS CLOUD (Primary)                          │   │
│  │                                                                      │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │   │
│  │  │   Route 53   │───▶│ CloudFront   │───▶│    ALB (HTTPS)       │   │   │
│  │  │    (DNS)     │    │   (CDN)      │    │  (SSL/TLS 1.3)       │   │   │
│  │  └──────────────┘    └──────────────┘    └──────────┬───────────┘   │   │
│  │                                                      │                │   │
│  │                           ┌──────────────────────────┘                │   │
│  │                           ▼                                           │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │                    ECS Fargate Cluster                         │    │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │    │   │
│  │  │  │  FastAPI   │  │  FastAPI   │  │  FastAPI   │  (3 replicas)│    │   │
│  │  │  │  Service   │  │  Service   │  │  Service   │              │    │   │
│  │  │  │  (2 vCPU)  │  │  (2 vCPU)  │  │  (2 vCPU)  │              │    │   │
│  │  │  └────────────┘  └────────────┘  └────────────┘              │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                           │                                         │   │
│  │                           ▼                                         │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │              AWS Services (HIPAA-Eligible)                     │    │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │    │   │
│  │  │  │  RDS       │  │  ElastiCache│  │   S3       │              │    │   │
│  │  │  │PostgreSQL  │  │  (Redis)   │  │  (KMS)     │              │    │   │
│  │  │  │  (Multi-AZ)│  │  (Queue)   │  │  (Files)   │              │    │   │
│  │  │  └────────────┘  └────────────┘  └────────────┘              │    │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │    │   │
│  │  │  │  Secrets   │  │ CloudWatch │  │   SNS      │              │    │   │
│  │  │  │  Manager   │  │  (Logs)    │  │  (Alerts)  │              │    │   │
│  │  │  └────────────┘  └────────────┘  └────────────┘              │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    BACKUP & DR (Cross-Region)                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │   │
│  │  │   S3         │  │   RDS        │  │   Route 53   │                │   │
│  │  │  (Backups)   │  │  (Replica)   │  │  (Failover)  │                │   │
│  │  │  (Glacier)   │  │  (us-west-2) │  │              │                │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack & Justification

| Component | Technology | Justification |
|-----------|------------|---------------|
| **Container Orchestration** | AWS ECS Fargate | Serverless containers, no EC2 management, auto-scaling, HIPAA-eligible [^50^] |
| **Database** | RDS PostgreSQL Multi-AZ | ACID compliance, JSON support, automated backups, read replicas |
| **Cache/Queue** | ElastiCache Redis | Session management, real-time queue state, pub/sub for notifications |
| **Object Storage** | S3 with KMS | Encrypted medical images, voice recordings, audit logs |
| **API Gateway** | Application Load Balancer | SSL termination, path-based routing, health checks |
| **CDN** | CloudFront | Global edge locations, reduced latency for static assets |
| **DNS** | Route 53 | Health-based routing, failover to DR region |
| **Secrets** | Secrets Manager | Rotation, encryption, no hardcoded credentials |
| **Monitoring** | CloudWatch + X-Ray | Metrics, logs, distributed tracing |
| **CI/CD** | CodePipeline + ECR | Automated testing, container scanning, deployment |

## Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  # FastAPI Application
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: telemedicine_api
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/telemedicine
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=dev-secret-key-change-in-production
      - ENVIRONMENT=development
      - AWS_REGION=us-east-1
    volumes:
      - ./backend:/app
      - /app/__pycache__
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - telemedicine-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # PostgreSQL Database
  db:
    image: postgres:15-alpine
    container_name: telemedicine_db
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=telemedicine
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    ports:
      - "5432:5432"
    networks:
      - telemedicine-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Redis Cache & Queue
  redis:
    image: redis:7-alpine
    container_name: telemedicine_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - telemedicine-network
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru

  # Celery Worker (Background Tasks)
  celery:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: telemedicine_celery
    command: celery -A app.services.tasks worker --loglevel=info --concurrency=4
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/telemedicine
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=dev-secret-key
    depends_on:
      - db
      - redis
    networks:
      - telemedicine-network
    volumes:
      - ./backend:/app

  # Celery Beat (Scheduler)
  celery-beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: telemedicine_beat
    command: celery -A app.services.tasks beat --loglevel=info
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/telemedicine
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    networks:
      - telemedicine-network

  # Frontend (Nginx serving static files)
  frontend:
    image: nginx:alpine
    container_name: telemedicine_frontend
    ports:
      - "80:80"
    volumes:
      - ./frontend/templates:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api
    networks:
      - telemedicine-network

  # MinIO (S3-compatible object storage for local dev)
  minio:
    image: minio/minio:latest
    container_name: telemedicine_minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    networks:
      - telemedicine-network

volumes:
  postgres_data:
  redis_data:
  minio_data:

networks:
  telemedicine-network:
    driver: bridge
```

## Production Deployment (AWS ECS)

### Step 1: Infrastructure as Code (Terraform)

```hcl
# terraform/main.tf
provider "aws" {
  region = "us-east-1"
}

# VPC and Networking
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "telemedicine-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false
  enable_vpn_gateway = false

  tags = {
    Environment = "production"
    Project     = "telemedicine"
    HIPAA       = "true"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "telemedicine-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"

      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }
}

# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier           = "telemedicine-postgres"
  allocated_storage    = 100
  storage_type         = "gp3"
  engine              = "postgres"
  engine_version      = "15.4"
  instance_class      = "db.t3.medium"
  db_name             = "telemedicine"
  username            = "dbadmin"
  password            = aws_secretsmanager_secret_version.db_password.secret_string

  multi_az               = true
  storage_encrypted      = true
  kms_key_id            = aws_kms_key.rds.arn

  backup_retention_period = 35
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  deletion_protection    = true
  skip_final_snapshot    = false

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  enabled_cloudwatch_logs_exports = ["postgresql"]

  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.rds.arn

  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  tags = {
    HIPAA = "true"
  }
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "telemedicine-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 2
  parameter_group_name = "default.redis7"
  port                 = 6379

  security_group_ids = [aws_security_group.redis.id]
  subnet_group_name  = aws_elasticache_subnet_group.main.name

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  snapshot_retention_limit = 7
  snapshot_window         = "05:00-06:00"
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "telemedicine-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = true
  enable_http2              = true

  access_logs {
    bucket  = aws_s3_bucket.logs.bucket
    prefix  = "alb-logs"
    enabled = true
  }
}

# ECS Service
resource "aws_ecs_service" "api" {
  name            = "telemedicine-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 3
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  propagate_tags = "SERVICE"

  tags = {
    HIPAA = "true"
  }
}

# Auto-scaling
resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = 10
  min_capacity       = 3
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "cpu-auto-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
```

### Step 2: CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: telemedicine-api
  ECS_CLUSTER: telemedicine-cluster
  ECS_SERVICE: telemedicine-api

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'

    - name: Install dependencies
      run: |
        pip install -r backend/requirements.txt
        pip install pytest pytest-cov

    - name: Run tests
      run: |
        pytest tests/ -v --cov=app --cov-report=xml

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml

  security-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

  build-and-deploy:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
    - uses: actions/checkout@v3

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}

    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1

    - name: Build, tag, and push image
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
        echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

    - name: Download task definition
      run: |
        aws ecs describe-task-definition --task-definition telemedicine-api --query taskDefinition > task-definition.json

    - name: Fill in image ID
      id: task-def
      uses: aws-actions/amazon-ecs-render-task-definition@v1
      with:
        task-definition: task-definition.json
        container-name: api
        image: ${{ steps.build-image.outputs.image }}

    - name: Deploy ECS task definition
      uses: aws-actions/amazon-ecs-deploy-task-definition@v1
      with:
        task-definition: ${{ steps.task-def.outputs.task-definition }}
        service: ${{ env.ECS_SERVICE }}
        cluster: ${{ env.ECS_CLUSTER }}
        wait-for-service-stability: true

    - name: Notify Slack
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        text: 'Deployment to production ${{ job.status }}'
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## HIPAA Compliance Checklist

### Administrative Safeguards
- [ ] Security Management Process (Risk Analysis)
- [ ] Assigned Security Responsibilities
- [ ] Workforce Training (Annual)
- [ ] Information Access Management
- [ ] Security Incidents Procedures
- [ ] Contingency Plan (Backup, DR)
- [ ] Business Associate Agreements

### Physical Safeguards
- [ ] Facility Access Controls
- [ ] Workstation Security
- [ ] Device and Media Controls

### Technical Safeguards
- [ ] Access Control (Unique User IDs)
- [ ] Audit Controls (Log all PHI access)
- [ ] Integrity Controls (Checksums)
- [ ] Person/Entity Authentication
- [ ] Transmission Security (TLS 1.3)

### AWS-Specific
- [ ] Signed BAA with AWS
- [ ] Use only HIPAA-eligible services
- [ ] Enable CloudTrail (all regions)
- [ ] Enable Config (Conformance Packs)
- [ ] VPC Flow Logs
- [ ] GuardDuty for threat detection
- [ ] Macie for PHI discovery in S3
- [ ] KMS encryption for all data
- [ ] Private subnets for PHI processing
- [ ] No public S3 buckets

## Monitoring & Alerting

### CloudWatch Alarms
- CPU Utilization > 70% for 5 minutes
- Memory Utilization > 80% for 5 minutes
- 5xx errors > 10 in 1 minute
- Response time > 2 seconds average
- RDS connections > 80% of max
- Failed login attempts > 5 in 5 minutes

### Log Aggregation
- Application logs → CloudWatch Logs
- Database audit logs → CloudWatch Logs
- ALB access logs → S3 → Athena
- VPC Flow Logs → S3 → QuickSight
- Security findings → GuardDuty → SNS

## Cost Estimation (Monthly)

| Component | Instance | Cost (USD) |
|-----------|----------|------------|
| ECS Fargate | 3 tasks × 2 vCPU × 4GB | $200 |
| RDS PostgreSQL | db.t3.medium Multi-AZ | $150 |
| ElastiCache | cache.t3.micro × 2 | $50 |
| ALB | 1 ALB + LCU | $25 |
| CloudFront | 100GB transfer | $10 |
| S3 | 500GB storage | $12 |
| Secrets Manager | 10 secrets | $4 |
| CloudWatch | Logs + Metrics | $30 |
| KMS | 1 key + requests | $3 |
| **Total** | | **~$484/month** |

## Disaster Recovery

### RPO (Recovery Point Objective): 15 minutes
- Continuous RDS backup to cross-region S3
- Redis snapshot every 15 minutes
- Async replication to standby region

### RTO (Recovery Time Objective): 1 hour
- Automated Route 53 failover
- Pre-warmed ECS cluster in DR region
- Database promotion script (automated)

### DR Procedure
1. Detect failure (CloudWatch alarm)
2. Update Route 53 health check (automated)
3. Promote RDS read replica in us-west-2
4. Scale ECS service in DR region
5. Notify on-call engineer
6. Post-incident review within 24h

## Security Best Practices

1. **Defense in Depth**: VPC → Security Group → NACL → IAM
2. **Least Privilege**: IAM roles with minimal permissions
3. **Encryption**: At rest (KMS) + In transit (TLS 1.3)
4. **Secrets Management**: No hardcoded credentials
5. **Network Segmentation**: Private subnets for PHI
6. **Monitoring**: Real-time alerts for anomalies
7. **Patching**: Automated OS patching via ECS
8. **Backup**: Immutable backups with 35-day retention
9. **Testing**: Quarterly DR drills
10. **Compliance**: Annual third-party HIPAA audit

## Deployment Commands

```bash
# Local Development
docker-compose up --build

# Staging (ECS)
aws ecs update-service --cluster telemedicine-staging --service api --force-new-deployment

# Production (Blue/Green)
# Use CodeDeploy for zero-downtime deployment
aws deploy create-deployment   --application-name telemedicine   --deployment-group-name production   --revision revisionType=AppSpecContent,appSpecContent={file://appspec.yml}

# Database Migration
aws ecs run-task   --cluster telemedicine   --task-definition telemedicine-migrate   --launch-type FARGATE   --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=DISABLED}"
```
