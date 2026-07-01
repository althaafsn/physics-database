output "public_ip" {
  description = "Public IP — api.labfisika.com A record points here"
  value       = aws_instance.admin_api.public_ip
}

output "instance_id" {
  value = aws_instance.admin_api.id
}

output "ssh_command" {
  value = "ssh -i ~/.ssh/${var.key_name}.pem ec2-user@${aws_instance.admin_api.public_ip}"
}

output "api_url_hint" {
  value = var.api_domain != "" ? "https://${var.api_domain}" : "http://${aws_instance.admin_api.public_ip}:8000"
}

output "jwt_secret" {
  description = "Save this — also written to /opt/physics-database/admin/server/.env on the instance"
  value       = random_password.jwt_secret.result
  sensitive   = true
}

output "next_build_env" {
  description = "Use when rebuilding the static site with the editor enabled"
  value       = "NEXT_PUBLIC_ENABLE_ADMIN=true NEXT_PUBLIC_ADMIN_API_URL=${var.api_domain != "" ? "https://${var.api_domain}" : "http://${aws_instance.admin_api.public_ip}:8000"}"
}
