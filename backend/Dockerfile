# Backend de Brindix (Spring Boot, Java 17)
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd -r -u 1001 brindix && mkdir -p /data/uploads && chown -R brindix /data
COPY --from=build /app/target/brindix.jar app.jar
USER brindix
ENV BRINDIX_UPLOADS_DIR=/data/uploads JAVA_OPTS="-Xms128m -Xmx384m"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
