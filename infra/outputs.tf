output "api_base_url" { value = aws_apigatewayv2_api.http.api_endpoint }
output "dynamodb_table" { value = aws_dynamodb_table.items.name }
