# Gateway endpoint (S3) has no hourly charge, unlike a NAT Gateway or Interface
# Endpoint. dbInit/appointmentCountry run inside the VPC with no other route to the
# internet, and the CloudFormation custom-resource response itself is an HTTPS PUT to a
# pre-signed S3 URL - without this, even sending a "SUCCESS"/"FAILED" signal back to
# CloudFormation times out.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]
}

# Interface endpoint (EventBridge only offers Interface, not Gateway - billed hourly +
# per-GB, but required here) so appointmentCountry's EventBridgeConfirmationBus.publish
# (PutEvents) can actually reach the events API from inside the VPC instead of timing
# out. This is the same real bug found and fixed in an earlier session
# (see project-cloud-repos-goal memory) - now provisioned by Terraform instead of the
# CloudFormation resource it replaces.
resource "aws_vpc_endpoint" "eventbridge" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.region}.events"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.eventbridge_endpoint.id]
}
