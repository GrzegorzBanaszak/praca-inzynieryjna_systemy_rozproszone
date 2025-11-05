# etap 1: build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# kopiujemy tylko .csproj, by przyspieszy� cache
COPY ["ProductService.csproj", "./"]
RUN dotnet restore "./ProductService.csproj"

# kopiujemy ca�y kod i publikujemy
COPY . .
RUN dotnet publish "ProductService.csproj" -c Release -o /app/publish

# etap 2: runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 80
EXPOSE 3000
ENTRYPOINT ["dotnet", "ProductService.dll"]
