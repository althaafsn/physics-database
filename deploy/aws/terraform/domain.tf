variable "site_domain" {
  type        = string
  description = "Primary custom domain (e.g. labfisika.com). Empty = CloudFront default URL only."
  default     = ""
}

variable "route53_zone_id" {
  type        = string
  description = "Route 53 hosted zone ID for site_domain (e.g. Z1D633PJN98FT9, from Route53 console)"
  default     = ""
}

locals {
  use_custom_domain = var.site_domain != "" && var.route53_zone_id != ""
  site_aliases      = local.use_custom_domain ? [var.site_domain, "www.${var.site_domain}"] : []
  route53_zone_id   = var.route53_zone_id
}

resource "aws_acm_certificate" "site" {
  count = local.use_custom_domain ? 1 : 0

  domain_name               = var.site_domain
  subject_alternative_names = ["www.${var.site_domain}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Project = var.project_name
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = local.use_custom_domain ? {
    for dvo in aws_acm_certificate.site[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = local.route53_zone_id
}

resource "aws_acm_certificate_validation" "site" {
  count = local.use_custom_domain ? 1 : 0

  certificate_arn         = aws_acm_certificate.site[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

resource "aws_route53_record" "apex" {
  count = local.use_custom_domain ? 1 : 0

  zone_id = local.route53_zone_id
  name    = var.site_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "apex_ipv6" {
  count = local.use_custom_domain ? 1 : 0

  zone_id = local.route53_zone_id
  name    = var.site_domain
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www" {
  count = local.use_custom_domain ? 1 : 0

  zone_id = local.route53_zone_id
  name    = "www.${var.site_domain}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_ipv6" {
  count = local.use_custom_domain ? 1 : 0

  zone_id = local.route53_zone_id
  name    = "www.${var.site_domain}"
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}
