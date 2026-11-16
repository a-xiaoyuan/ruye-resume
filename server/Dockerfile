# 构建：docker build -t ruye-server server/
# 运行：docker run -p 8080:8080 -e RUYE_JWT_SECRET=$(openssl rand -base64 48) -e RUYE_CORS_ORIGINS=https://你的前端域名 -v ruye-data:/app/data ruye-server
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd --system --uid 10001 ruye && mkdir -p /app/data && chown ruye /app/data
COPY --from=build /src/target/ruye-server-*.jar /app/ruye-server.jar
USER ruye
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/ruye-server.jar"]
