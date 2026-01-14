# Auto-generated TypeScript Client

The TypeScript client is **automatically regenerated** whenever you run `dotnet build` on the server project. No running server is required.

## How it works

The build process uses NSwag to:
1. Generate `swagger.json` from the compiled assembly using ASP.NET Core's ApiExplorer
2. Generate `generatedClient.ts` from the swagger.json

## Manual regeneration (if needed)

If you need to regenerate manually or disable auto-generation:

### Disable auto-generation for a single build:
```bash
dotnet build /p:GenerateTypeScriptClient=false
```

### Manual generation against a running server (legacy method):

- Ensure the API is running locally at http://localhost:5188 (Swagger at /swagger/v1/swagger.json).
- From the server project folder (`src/Cliq.Server`):

	dotnet "/Users/robertwetzler/.nuget/packages/nswag.msbuild/14.2.0/tools/Net80/dotnet-nswag.dll" run nswag.json /variables:SwaggerUrl=http://localhost:5188/swagger/v1/swagger.json,OutputFile=../cliq.client/services/generated/generatedClient.ts

## Notes

- The config file is at `src/Cliq.Server/nswag.json` (used for legacy manual generation).
- The build-time generation is configured in `src/Cliq.Server/Cliq.Server.csproj`.
- `swagger.json` is generated in the server project folder during build and should be in `.gitignore`.