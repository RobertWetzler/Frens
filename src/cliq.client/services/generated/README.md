On windows using nswag CLI:

nswag openapi2tsclient /input:http://localhost:5265/swagger/v1/swagger.json /output:..\cliq.client\services\generated\generatedClient.ts

On Mac:
dotnet "/Users/robertwetzler/.nuget/packages/nswag.msbuild/14.2.0/build/../tools/Net80/dotnet-nswag.dll" openapi2tsclient /input:http://localhost:5188/swagger/v1/swagger.json /output:../cliq.client/services/generated/generatedClient.ts