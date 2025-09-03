variable "aws_region" { type = string default = "us-east-1" }
variable "project" { type = string default = "serverless-terraform" }
variable "name_table" { type = string default = "serverless-terraform-items" }
variable "ssm_prefix" { type = string default = "/serverless-terraform/" }
variable "allowed_cors_origins" { type = list(string) default = ["http://localhost:3000"] }
