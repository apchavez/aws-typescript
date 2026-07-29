terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Bucket/key/region are supplied via -backend-config flags in deploy.yml/destroy.yml
  # (bucket name is stage-specific, so it can't be hardcoded here) - the deploy workflow
  # bootstraps the bucket idempotently before the first `terraform init`, same pattern
  # already used for the SSM secret parameters in this repo.
  backend "s3" {}
}
