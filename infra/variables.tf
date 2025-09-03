variable "aws_region" { type = string default = "us-east-1" }
variable "project" { type = string default = "serverless-ttx" }
variable "table_name" { type = string default = "serverless-ttx-items" }
variable "ssm_prefix" { type = string default = "/serverless-ttx/" }
variable "allowed_cors_origins" { type = list(string) default = ["http://localhost:3000"] }
