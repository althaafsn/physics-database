# AWS static site deploy

Host the static `out/` folder on **S3 + CloudFront** (~$0.50–$2/mo for light traffic).

## Prerequisites

1. AWS CLI configured (`aws sts get-caller-identity`)
2. IAM permissions in `iam-deploy-policy.json` attached to your deploy user  
   (admin can run `./attach-deploy-policy.sh`)
3. Node.js + npm

## Deploy

```bash
chmod +x deploy/aws/deploy.sh
./deploy/aws/deploy.sh
```

This will:

1. Run `npm run build:static` → `out/`
2. Create/update S3 bucket + CloudFront distribution (Terraform)
3. Sync files to S3 and invalidate CloudFront cache
4. Print the live HTTPS URL (`https://dxxxx.cloudfront.net`)

## Update after catalog changes

```bash
python scripts/sync_catalog.py
./deploy/aws/deploy.sh
```

## Teardown

```bash
./deploy/aws/teardown.sh
```

## Manual Terraform

```bash
cd deploy/aws/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply
cd ../..
aws s3 sync out/ s3://$(terraform -chdir=deploy/aws/terraform output -raw bucket_name) --delete
aws cloudfront create-invalidation \
  --distribution-id $(terraform -chdir=deploy/aws/terraform output -raw cloudfront_distribution_id) \
  --paths '/*'
```

## Cost notes

| Service | Typical cost |
|---------|--------------|
| S3 storage (~2 MB site) | pennies |
| CloudFront (light traffic) | ~$0.50–$2/mo |
| Lightsail containers | **removed** — was ~$7/mo |

No budget/Lambda teardown stack — static hosting costs are negligible.
