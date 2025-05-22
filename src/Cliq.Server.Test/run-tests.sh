#!/bin/bash
# This script is used to run the tests against a PostgreSQL database
# using Docker. It will start a PostgreSQL container, wait for it to be ready,
# NOTE: Manually run docker compuse up -d if you need to debug the tests
# Don't immediately exit on error
set +e

# Start the database
echo "🚀 Starting test database container..."
docker compose -f docker-compose.yml up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
CONTAINER_NAME=$(docker ps -q -f name=test-db)
until docker exec $CONTAINER_NAME pg_isready -U postgres > /dev/null 2>&1; do
  echo "Still waiting for PostgreSQL to become available..."
  sleep 1
done
echo "✅ Database is ready"

# Run the tests and capture exit code
echo "🧪 Running tests..."
dotnet test
TEST_EXIT_CODE=$?

# Always clean up regardless of test outcome
echo "🧹 Cleaning up test containers..."
docker compose -f docker-compose.yml down
echo "✨ Done"

# Exit with the original test exit code
exit $TEST_EXIT_CODE