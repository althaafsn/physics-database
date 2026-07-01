data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

resource "aws_security_group" "admin_api" {
  name        = "${var.project_name}-sg"
  description = "SSH + HTTP/S for Physics DB admin API"

  ingress {
    description = "SSH from your IP"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr]
  }

  ingress {
    description = "HTTP (Caddy / Lets Encrypt)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Default egress (allow all outbound) — omit custom egress block so Terraform
  # does not need ec2:RevokeSecurityGroupEgress on btree-deploy.

  tags = {
    Name = "${var.project_name}-sg"
  }
}

resource "aws_instance" "admin_api" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.admin_api.id]
  associate_public_ip_address = true

  user_data = templatefile("${path.module}/user-data.sh", {
    admin_email  = var.admin_email
    cors_origin  = var.cors_origin
    api_domain   = var.api_domain
    jwt_secret   = random_password.jwt_secret.result
  })

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = {
    Name = var.project_name
  }
}

resource "random_password" "jwt_secret" {
  length  = 48
  special = false
}
