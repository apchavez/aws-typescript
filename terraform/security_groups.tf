# Moved here from serverless.yml (was `LambdaSecurityGroup` in the CloudFormation
# resources block) so that both this SG and `aws_security_group.rds` - which needs to
# reference it for its ingress rule - can live in the same tool without a circular
# dependency between the Terraform (network/platform) and Serverless Framework
# (application) layers. Serverless Framework's Lambda functions only need this SG's ID
# as a plain external string (see `custom.network.lambdaSecurityGroupId` in
# serverless.yml), the same way they already reference the subnet IDs.
resource "aws_security_group" "lambda" {
  name        = "clinic-scheduling-platform-lambda"
  description = "Security group for Lambda functions"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "rds" {
  name        = "clinic-scheduling-platform-rds"
  description = "MySQL inbound - Lambda SG only"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_lambda" {
  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = aws_security_group.lambda.id
  ip_protocol                  = "tcp"
  from_port                    = 3306
  to_port                      = 3306
}

resource "aws_vpc_security_group_egress_rule" "lambda_to_rds" {
  security_group_id            = aws_security_group.lambda.id
  referenced_security_group_id = aws_security_group.rds.id
  ip_protocol                  = "tcp"
  from_port                    = 3306
  to_port                      = 3306
}

resource "aws_vpc_security_group_egress_rule" "lambda_https" {
  security_group_id = aws_security_group.lambda.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  description       = "HTTPS to AWS service endpoints (DynamoDB, SNS, SQS, SSM, X-Ray) via VPC endpoints"
}

resource "aws_vpc_security_group_egress_rule" "lambda_dns_tcp" {
  security_group_id = aws_security_group.lambda.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 53
  to_port           = 53
  description       = "DNS resolution (VPC resolver)"
}

resource "aws_vpc_security_group_egress_rule" "lambda_dns_udp" {
  security_group_id = aws_security_group.lambda.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "udp"
  from_port         = 53
  to_port           = 53
  description       = "DNS resolution (VPC resolver)"
}

# Interface endpoint SG (EventBridge only offers Interface, not Gateway - see
# vpc_endpoints.tf) - HTTPS inbound from the Lambda SG only.
resource "aws_security_group" "eventbridge_endpoint" {
  name        = "clinic-scheduling-platform-eventbridge-endpoint"
  description = "HTTPS inbound from Lambda SG only, for the EventBridge interface endpoint"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "eventbridge_endpoint_from_lambda" {
  security_group_id            = aws_security_group.eventbridge_endpoint.id
  referenced_security_group_id = aws_security_group.lambda.id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
}
