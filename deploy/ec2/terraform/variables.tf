variable "aws_region" {
  type        = string
  description = "AWS region for the admin API instance"
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Prefix for EC2 / security group names"
  default     = "physics-db-admin"
}

variable "instance_type" {
  type        = string
  description = "EC2 instance type (t3.micro is free-tier eligible)"
  default     = "t3.micro"
}

variable "key_name" {
  type        = string
  description = "Name of an existing EC2 key pair in this region (create in AWS Console first)"
}

variable "ssh_cidr" {
  type        = string
  description = "Your IP in CIDR form for SSH (e.g. 203.0.113.10/32). Find yours at https://ifconfig.me"
}

variable "api_domain" {
  type        = string
  description = "Optional FQDN for HTTPS via Caddy (e.g. api.example.com). Leave empty to skip Caddy."
  default     = ""
}

variable "admin_email" {
  type        = string
  description = "Email allowed to log in to the editor (ADMIN_ALLOWED_EMAILS)"
}

variable "cors_origin" {
  type        = string
  description = "CloudFront reader URL(s) for CORS (comma-separated)"
  default     = ""
}

variable "route53_zone_id" {
  type        = string
  description = "Route 53 hosted zone ID for api_domain DNS"
  default     = ""
}

