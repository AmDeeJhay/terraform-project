import { Construct } from "constructs";
import { App, TerraformStack, TerraformOutput } from "cdktf";
import { AwsProvider, dynamodbTable, lambdaFunction, iamRole, apigatewayv2Api, apigatewayv2Integration, apigatewayv2Route, apigatewayv2Stage } from "@cdktf/provider-aws";

class ServerlessTtxStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new AwsProvider(this, "AWS", {
      region: "us-east-1"
    });

    // DynamoDB
    const table = new dynamodbTable.DynamodbTable(this, "itemsTable", {
      name: "serverless-ttx-items",
      hashKey: "id",
      attribute: [{ name: "id", type: "S" }],
      billingMode: "PAY_PER_REQUEST"
    });

    // IAM Role for Lambda
    const role = new iamRole.IamRole(this, "lambdaRole", {
      name: "serverless-ttx-role",
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
          Effect: "Allow",
          Principal: { Service: "lambda.amazonaws.com" },
          Action: "sts:AssumeRole"
        }]
      })
    });

    // Lambda
    const lambda = new lambdaFunction.LambdaFunction(this, "apiLambda", {
      functionName: "serverless-ttx-lambda",
      role: role.arn,
      runtime: "nodejs20.x",
      handler: "handler.handler",
      filename: "../backend/lambda.zip"
    });

    // API Gateway HTTP API
    const api = new apigatewayv2Api.Apigatewayv2Api(this, "httpApi", {
      name: "serverless-ttx-api",
      protocolType: "HTTP"
    });

    const integration = new apigatewayv2Integration.Apigatewayv2Integration(this, "lambdaIntegration", {
      apiId: api.id,
      integrationType: "AWS_PROXY",
      integrationUri: lambda.invokeArn
    });

    new apigatewayv2Route.Apigatewayv2Route(this, "itemsRoute", {
      apiId: api.id,
      routeKey: "ANY /items",
      target: `integrations/${integration.id}`
    });

    new apigatewayv2Stage.Apigatewayv2Stage(this, "devStage", {
      apiId: api.id,
      name: "dev",
      autoDeploy: true
    });

    new TerraformOutput(this, "api_url", {
      value: api.apiEndpoint
    });
  }
}

const app = new App();
new ServerlessTtxStack(app, "serverless-ttx");
app.synth();
