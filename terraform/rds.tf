# Read-only: deploy.yml/destroy.yml bootstrap this SSM parameter (idempotent
# get-or-create) BEFORE running `terraform apply`, so it always exists by the time
# this data source resolves. Terraform never writes this value itself - the same
# secret is also read directly by Serverless Framework's `SecretsInitCustom` custom
# resource (src/infra/secrets-init.ts), so both tools share one source of truth
# instead of each generating/storing their own password.
data "aws_ssm_parameter" "rds_password" {
  name            = "/appointments/rds/password"
  with_decryption = true
}

resource "aws_db_subnet_group" "appointments" {
  name       = "clinic-scheduling-platform-rds"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "Subnets for appointments RDS"
  }
}

resource "aws_db_instance" "appointments" {
  identifier     = "clinic-scheduling-platform"
  engine         = "mysql"
  engine_version = "8.0"
  instance_class = "db.t4g.micro"

  allocated_storage   = 20
  storage_encrypted   = true
  db_name             = var.db_name
  username            = var.db_username
  password            = data.aws_ssm_parameter.rds_password.value
  publicly_accessible = false
  multi_az            = false

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.appointments.name

  deletion_protection     = true
  backup_retention_period = var.db_backup_retention_days
  skip_final_snapshot     = true
  apply_immediately       = true
}

# Same SSM path the previous CloudFormation-managed `RDSHostParam` wrote to - kept so
# any consumer expecting the RDS host at this path (docs, manual debugging) still finds
# it; the app itself gets the host directly via a plain Terraform output (see
# custom.network.rdsHost in serverless.yml), not by reading this parameter at runtime.
resource "aws_ssm_parameter" "rds_host" {
  name  = "/appointments/rds/host"
  type  = "String"
  value = aws_db_instance.appointments.address
}
