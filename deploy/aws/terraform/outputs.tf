output "bucket_name" {
  value = aws_s3_bucket.site.bucket
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "site_url" {
  value = local.use_custom_domain ? "https://${var.site_domain}" : "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "site_domain" {
  value = var.site_domain
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.site.domain_name
}
