import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssm = new SSMClient({});

const TABLE = process.env.TABLE_NAME || 'serverless-ttx-items';
const SSM_PREFIX = process.env.SSM_PREFIX || '/serverless-ttx/';

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const path = event.rawPath || '/';
  const method = event.requestContext.http.method;

  if (path.endsWith('/health')) {
    return { statusCode:200, body: JSON.stringify({status:'ok'}) };
  }

  if (path.endsWith('/items') && method === 'POST') {
    const body = event.body ? JSON.parse(event.body) : {};
    const { id, value } = body;
    if (!id || !value) return { statusCode:400, body: JSON.stringify({error:'id and value required'}) };
    await ddb.send(new PutCommand({ TableName: TABLE, Item: { id, value, ts: Date.now() } }));
    return { statusCode:201, body: JSON.stringify({ok:true, id}) };
  }

  if (path.endsWith('/items') && method === 'GET') {
    const res = await ddb.send(new ScanCommand({ TableName: TABLE }));
    return { statusCode:200, body: JSON.stringify(res.Items || []) };
  }

  return { statusCode:404, body: JSON.stringify({error:'not found'}) };
};
