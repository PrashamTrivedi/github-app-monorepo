# Purpose

Integrate Swagger UI on backend and validate the inputs with Zod.

## Requirements

- Create two paths `/api-docs` and `/swagger`. API Docs should serve API docs in
  JSON while Swagger should server the swagger UI

- Use Zod for API Validation and Definitions

- With hono, We can use [Zod OpenAPI](https://hono.dev/examples/zod-openapi) to
  support OpenAPI docs and [SwaggerUI](https://hono.dev/examples/swagger-ui) to
  support swagger.

- Make sure all the current APIs are covered with validation and swagger
  documentation

- Make sure we use current server address, so that it can run in anywhere it is
  deployed.

## Acceptance Criteria

- All existing APIs are covered with Zod validation and have corresponding
  Swagger documentation.
- All existing APIs are running in swagger
- Swagger UI is working in atleast two ports to demonstrate the server address
  locally.
