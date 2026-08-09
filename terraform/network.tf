data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "clinic-scheduling-platform"
  }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "clinic-scheduling-platform-private-${count.index + 1}"
  }
}

# No NAT Gateway/Internet Gateway on purpose - Lambdas/RDS only ever need the S3 Gateway
# Endpoint (DbInit's CloudFormation custom-resource response) and the EventBridge
# Interface Endpoint (appointmentCountry's PutEvents call) below, both defined in
# vpc_endpoints.tf. This keeps the network layer at zero hourly cost beyond the
# EventBridge Interface Endpoint itself (Gateway endpoints are free; NAT/Interface
# endpoints are billed hourly - EventBridge has no Gateway option, so that one hourly
# charge is unavoidable if PutEvents needs to work from inside the VPC).
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "clinic-scheduling-platform-private"
  }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
