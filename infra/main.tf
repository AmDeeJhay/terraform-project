resource "aws_dynamodb_table" "items" {
  name = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key = "id"
  attribute { name = "id" type = "S" }
}

data "archive_file" "lambda_zip" {
  type = "zip"
  source_dir = "${path.module}/../backend/dist"
  output_path = "${path.module}/../backend/lambda.zip"
}

resource "aws_iam_role" "lambda_exec" {
  name = "${var.project}-lambda-exec"
  assume_role_policy = data.aws_iam_policy_document.assume_lambda.json
}

data "aws_iam_policy_document" "assume_lambda" {
  statement { actions = ["sts:AssumeRole"] principals { type = "Service" identifiers = ["lambda.amazonaws.com"] } }
}

data "aws_iam_policy_document" "lambda_policy" {
  statement {
    sid = "CloudWatchLogs"
    actions = ["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"]
  }
  statement {
    sid = "DynamoDB"
    actions = ["dynamodb:PutItem","dynamodb:Scan"]
    resources = [aws_dynamodb_table.items.arn]
  }
  statement {
    sid = "SSMRead"
    actions = ["ssm:GetParameter","ssm:GetParameters","ssm:GetParametersByPath"]
    resources = ["arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_prefix}*"]
  }
}

resource "aws_iam_policy" "lambda_policy" { name = "${var.project}-lambda-policy" policy = data.aws_iam_policy_document.lambda_policy.json }
resource "aws_iam_role_policy_attachment" "lambda_attach" { role = aws_iam_role.lambda_exec.name policy_arn = aws_iam_policy.lambda_policy.arn }

resource "aws_lambda_function" "api" {
  function_name = "${var.project}-api"
  role = aws_iam_role.lambda_exec.arn
  handler = "index.handler"
  runtime = "nodejs20.x"
  filename = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.items.name
      SSM_PREFIX = var.ssm_prefix
    }
  }
}

resource "aws_apigatewayv2_api" "http" {
  name = "${var.project}-http-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = var.allowed_cors_origins
    allow_methods = ["GET","POST","OPTIONS"]
    allow_headers = ["content-type","authorization"]
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id = aws_apigatewayv2_api.http.id
  integration_type = "AWS_PROXY"
  integration_uri = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "default" {
  api_id = aws_apigatewayv2_api.http.id
  route_key = "$default"
  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id = aws_apigatewayv2_api.http.id
  name = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "allow_apigw" {
  statement_id = "AllowAPIGatewayInvoke"
  action = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.arn
  principal = "apigateway.amazonaws.com"
  source_arn = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

