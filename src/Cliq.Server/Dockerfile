ARG DOTNET_SDK_VERSION=8.0
ARG DOTNET_OS_VERSION=-alpine

# ---------- build stage ----------
FROM node:20-alpine AS client-build
WORKDIR /client
COPY src/cliq.client ./cliq.client
WORKDIR /client/cliq.client
RUN npm install
RUN npx expo export -p web

# ---------- backend build ----------
FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_SDK_VERSION}${DOTNET_OS_VERSION} AS build
WORKDIR /src
COPY src/Cliq.Server ./
COPY --from=client-build /client/cliq.client/dist ./wwwroot

RUN dotnet restore
RUN dotnet publish -c Release -o /app -p:BuildFrontendEnabled=false

# ---------- final stage ----------
FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_SDK_VERSION}
ENV ASPNETCORE_URLS http://+:8080
ENV ASPNETCORE_ENVIRONMENT Production
EXPOSE 8080
WORKDIR /app
COPY --from=build /app .
# Copy assets separately to ensure they're included
COPY --from=client-build /client/cliq.client/dist/assets ./wwwroot/assets

ENTRYPOINT ["dotnet", "Cliq.Server.dll"]