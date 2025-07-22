# Cliq Database (PostgreSQL on Fly.io)

The fly.toml file in this directory corresponds to the `cliq-db` PostgreSQL app on Fly.io.

## Database Connection

### Connect via Fly CLI (Recommended)
```bash
fly postgres connect -a cliq-db
```

This will establish a secure connection to the database and open a psql session.

### Working with the Database

Once connected, you'll be in the `postgres` database by default. Switch to the application database:

```sql
-- List all databases
\l

-- Connect to the cliq_server database (where application tables are stored)
\c cliq_server

-- List all tables
\dt

-- View users (note the double quotes for case-sensitive table names)
SELECT "Id", "Name", "Email" FROM "AspNetUsers";
```

### Common Database Operations

```sql
-- Count total users
SELECT COUNT(*) FROM "AspNetUsers";

-- Update a user's name
UPDATE "AspNetUsers" 
SET "Name" = 'New Name' 
WHERE "Id" = 'user-id-here';

-- View table structure
\d "AspNetUsers"

-- Exit psql
\q
```

### Important Notes

- **Case Sensitivity**: Table names use Pascal case (e.g., `"AspNetUsers"`) and must be quoted
- **Database Name**: Application data is stored in `cliq_server`, not the default `postgres` database
- **Deprecation Warning**: Unmanaged Postgres is deprecated in favor of Fly's Managed Postgres (`fly mpg`)

## Database Management

### Scale to Zero Configuration
Commands to use (From https://fly.io/docs/postgres/managing/scale-to-zero/)

```bash
fly config save --app cliq-db
```

Open the fly.toml file and remove the following line from the [env] section:
```
FLY_SCALE_TO_ZERO = "1h"
```

Verify what image you're running:
```bash
fly image show --app cliq-db
```

Deploy your changes:
```bash
fly deploy . --image flyio/postgres-flex:15.2
```l file in this dir corresponds to the cliq-db postgres app in fly.io.

Commands to use (From https://fly.io/docs/postgres/managing/scale-to-zero/)
fly config save --app 

Open the fly.toml file and remove the following line from the [env] section:
  FLY_SCALE_TO_ZERO = "1h"
Verify what image you’re running:
fly image show --app <app-name>
Finally, deploy your changes. For example:
fly deploy . --image flyio/postgres-flex:15.2