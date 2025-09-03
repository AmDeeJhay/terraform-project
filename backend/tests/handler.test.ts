import { handler } from "../handler";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

jest.mock("@aws-sdk/lib-dynamodb", () => {
  return {
    DynamoDBDocumentClient: { from: jest.fn().mockReturnValue({ send: jest.fn() }) },
    PutCommand: jest.fn(),
    ScanCommand: jest.fn()
  };
});

const mockSend = (DynamoDBDocumentClient.from({}) as any).send;

describe("Lambda Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return health check", async () => {
    const event: any = {
      rawPath: "/health",
      requestContext: { http: { method: "GET" } },
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain("ok");
  });

  it("should insert item into DynamoDB on POST /items", async () => {
    mockSend.mockResolvedValueOnce({});

    const event: any = {
      rawPath: "/items",
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify({ id: "123", value: "test" }),
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body).id).toBe("123");
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(PutCommand).toHaveBeenCalled();
  });

  it("should retrieve items from DynamoDB on GET /items", async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ id: "123", value: "test" }] });

    const event: any = {
      rawPath: "/items",
      requestContext: { http: { method: "GET" } },
    };

    const result = await handler(event);
    const body = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(body).toEqual([{ id: "123", value: "test" }]);
    expect(ScanCommand).toHaveBeenCalled();
  });

  it("should return 400 if id or value missing", async () => {
    const event: any = {
      rawPath: "/items",
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify({ value: "missing id" }),
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("id and value required");
  });

  it("should return 404 for unknown path", async () => {
    const event: any = {
      rawPath: "/unknown",
      requestContext: { http: { method: "GET" } },
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(404);
    expect(result.body).toContain("not found");
  });
});
