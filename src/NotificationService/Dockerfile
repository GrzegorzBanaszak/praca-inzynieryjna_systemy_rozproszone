# build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["NotificationService.csproj","./"]
RUN dotnet restore "./NotificationService.csproj"
COPY . .
RUN dotnet publish -c Release -o /app/publish

# runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 80
ENTRYPOINT ["dotnet","NotificationService.dll"]