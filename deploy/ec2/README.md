# EC2 admin API (cheapest AWS learning path)

Host the **FastAPI editor API** on a **t3.micro** (~free tier year 1, then ~\$8/mo with EIP).

The **public reader** stays on S3 + CloudFront (`deploy/aws/`). This only adds the admin backend.

## What you get

| Piece | Service |
|-------|---------|
| Reader | S3 + CloudFront (existing) |
| Admin API | EC2 t3.micro + Elastic IP |
| HTTPS API | Caddy + Let's Encrypt (needs a domain) |
| Users | SQLite on the instance |

## Prerequisites

1. AWS CLI configured: `aws sts get-caller-identity`
2. Terraform installed
3. An **EC2 key pair** in your region (Console → EC2 → Key pairs → Create → download `.pem`)
4. Your public IP for SSH: `curl -fsS ifconfig.me` → use `x.x.x.x/32`
5. **Optional but recommended:** a domain (e.g. `api.yourdomain.com` → A record to Elastic IP)

## Step 1 — Configure Terraform

```bash
cd deploy/ec2/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit: key_name, ssh_cidr, admin_email, cors_origin (your CloudFront URL)
# Set api_domain when you have a domain (e.g. api.example.com)
terraform init
terraform apply
```

Save outputs:

```bash
terraform output public_ip
terraform output -raw jwt_secret   # sensitive
terraform output ssh_command
```

Wait ~2 minutes for first-boot bootstrap (installs Python, Node, optional Caddy).

## Step 2 — Sync code to the server

From repo root:

```bash
chmod +x deploy/ec2/sync-to-server.sh deploy/ec2/finish-setup.sh
./deploy/ec2/sync-to-server.sh
```

## Step 3 — Finish setup on EC2

```bash
# use ssh_command from terraform output
ssh -i ~/.ssh/physics-db.pem ec2-user@<elastic-ip>
sudo bash /opt/physics-database/deploy/ec2/finish-setup.sh
```

Create your login:

```bash
cd /opt/physics-database/admin/server
sudo -u ec2-user PHYSICS_DB_ROOT=/opt/physics-database PYTHONPATH=/opt/physics-database \
  .venv/bin/python scripts/register_admin.py you@example.com 'your-secure-password'
```

Check health:

```bash
curl -s http://127.0.0.1:8000/health
# With domain + Caddy:
curl -s https://api.yourdomain.com/health
```

## Step 4 — DNS (if using api_domain)

At your registrar or Route 53:

| Type | Name | Value |
|------|------|-------|
| A | `api` | Elastic IP from `terraform output public_ip` |

Wait a few minutes, then Caddy will obtain a Let's Encrypt cert automatically.

## Step 5 — Deploy reader with editor enabled

```bash
export NEXT_PUBLIC_ADMIN_API_URL=https://api.yourdomain.com
./deploy/ec2/deploy-reader-with-editor.sh
```

Open `https://<cloudfront>/admin/login` and sign in.

## Day-2 workflow

1. Edit problems in the admin UI (or API).
2. Click **Sync & export** in the editor (updates `public/data/` on the server).
3. From your laptop, pull changes or re-sync, then redeploy static site:

```bash
./deploy/ec2/sync-to-server.sh    # server → laptop if you edited on server
# or rsync the other way after export on server
./deploy/aws/deploy.sh            # push reader to CloudFront
```

**Tip:** After editing on the server, run on EC2:

```bash
cd /opt/physics-database && npm run export:data
```

Then `rsync` `public/data/` down, or sync whole tree and run `./deploy/aws/deploy.sh` locally.

## Costs

| Resource | Typical |
|----------|---------|
| t3.micro (free tier) | \$0 first 12 months |
| t3.micro after | ~\$7.5/mo |
| Elastic IP (attached) | \$0 |
| 20 GB gp3 | ~\$1.6/mo |
| **Total** | **~\$0–9/mo** |

## Teardown

```bash
cd deploy/ec2/terraform
terraform destroy
```

## Troubleshooting

```bash
sudo systemctl status physics-admin
sudo journalctl -u physics-admin -f
sudo journalctl -u caddy -f
cat /var/log/physics-admin-bootstrap.log
```

**Mixed content error:** reader is HTTPS but API is HTTP → set `api_domain` and use HTTPS API URL.

**CORS error:** `cors_origin` in `terraform.tfvars` must match your CloudFront URL exactly (including `https://`).

**403 on login:** email must match `admin_email` in terraform.tfvars.

## Files

| File | Purpose |
|------|---------|
| `terraform/` | EC2 + security group + Elastic IP |
| `sync-to-server.sh` | Push repo to instance |
| `finish-setup.sh` | venv, systemd, Caddy |
| `physics-admin.service` | systemd unit |
| `deploy-reader-with-editor.sh` | Build + S3 deploy with editor on |
