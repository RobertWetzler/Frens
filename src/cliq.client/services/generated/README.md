Regenerate client using NSwag config (recommended):

- Ensure the API is running locally at http://localhost:5188 (Swagger at /swagger/v1/swagger.json).
- From the server project folder (`src/Cliq.Server`):

	dotnet "/Users/robertwetzler/.nuget/packages/nswag.msbuild/14.2.0/tools/Net80/dotnet-nswag.dll" run nswag.json /variables:SwaggerUrl=http://localhost:5188/swagger/v1/swagger.json,OutputFile=../cliq.client/services/generated/generatedClient.ts

Notes:
- The config file is at `src/Cliq.Server/nswag.json` and defaults to the same values above.
- You can override variables with `/variables:SwaggerUrl=...,OutputFile=...`.

Direct commands (alternative):

- Windows:

	nswag openapi2tsclient /input:http://localhost:5265/swagger/v1/swagger.json /output:..\cliq.client\services\generated\generatedClient.ts

- macOS:

	dotnet "/Users/robertwetzler/.nuget/packages/nswag.msbuild/14.2.0/tools/Net80/dotnet-nswag.dll" openapi2tsclient /input:http://localhost:5188/swagger/v1/swagger.json /output:../cliq.client/services/generated/generatedClient.ts