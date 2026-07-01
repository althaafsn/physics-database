resource "aws_route53_record" "api" {
  count = var.api_domain != "" && var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.api_domain
  type    = "A"
  ttl     = 300
  records = [aws_instance.admin_api.public_ip]
}
