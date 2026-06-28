variable "aws_region" {
  type        = string
  description = "AWS region for the S3 bucket"
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Short name used in resource labels"
  default     = "physics-db"
}
