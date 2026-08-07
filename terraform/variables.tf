variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "stage" {
  description = "Deployment stage (dev/staging/prod) - kept for tagging/consistency with the Serverless Framework app layer, this repo only ever deploys a single dev-shaped network"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for the dedicated VPC"
  type        = string
  default     = "10.42.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for the 2 private subnets Lambdas/RDS run in"
  type        = list(string)
  default     = ["10.42.1.0/24", "10.42.2.0/24"]
}

variable "db_name" {
  description = "MySQL database name"
  type        = string
  default     = "appointments"
}

variable "db_username" {
  description = "MySQL master username"
  type        = string
  default     = "admin"
}

variable "db_backup_retention_days" {
  description = "RDS automated backup retention in days - 0 (disabled) is accepted on every AWS account tier, free-plan accounts cap it below 7"
  type        = number
  default     = 0
}
