output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.app.id
}

output "public_ip" {
  description = "Elastic IP of EC2 instance (stable, survives stop/start)"
  value       = aws_eip.app.public_ip
}

output "public_dns" {
  description = "Public DNS of EC2 instance (resolves to Elastic IP)"
  value       = aws_instance.app.public_dns
}

output "ssh_command" {
  description = "SSH command to connect to the EC2 instance"
  value       = "ssh -i /path/to/your/key.pem ubuntu@${aws_eip.app.public_ip}"
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}
