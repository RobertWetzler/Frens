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

### Disable Scale to Zero (Keep Database Always Running)

To ensure your database is always available and doesn't scale to zero due to inactivity:

1. **Remove the scale-to-zero environment variable** from `fly.toml`:
   ```toml
   [env]
     PRIMARY_REGION = 'ord'
     # Remove this line: FLY_SCALE_TO_ZERO = "1h"
   ```

2. **Configure services to never auto-stop** in `fly.toml`:
   ```toml
   [[services]]
     protocol = 'tcp'
     internal_port = 5432
     auto_stop_machines = 'off'  # Prevents automatic stopping
     auto_start_machines = true
     min_machines_running = 1    # Ensures at least 1 machine is always running
   ```

3. **Verify your current image version**:
   ```bash
   fly image show --app cliq-db
   ```

4. **Deploy the configuration changes**:
   ```bash
   fly deploy . --image flyio/postgres-flex:17.2
   ```

5. **Verify the changes were applied**:
   ```bash
   fly config show --app cliq-db
   fly status --app cliq-db
   ```

### Current Configuration Status
- ✅ Scale-to-zero: **DISABLED** (removed `FLY_SCALE_TO_ZERO`)
- ✅ Auto-stop machines: **OFF** (`auto_stop_machines = 'off'`)
- ✅ Minimum machines: **1** (`min_machines_running = 1`)
- ✅ Database is always available

### Scale to Zero Configuration (Legacy Instructions)
*Note: These instructions are for reference only. Scale-to-zero has been disabled for reliability.*

Commands from [Fly.io docs](https://fly.io/docs/postgres/managing/scale-to-zero/):

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
fly deploy . --image flyio/postgres-flex:17.2
```

## Backup Management

### Automatic Snapshots
Fly.io automatically creates daily snapshots of your database volume:

```bash
# List existing snapshots
fly volumes snapshots list vol_4y7z78j2120w23p4

# Create a manual snapshot
fly volumes snapshots create vol_4y7z78j2120w23p4
```

### Manual Database Backup
For additional safety, you can create manual database dumps:

```bash
# Create a backup of the entire database
fly postgres connect -a cliq-db -c "pg_dump cliq_server" > backup.sql

# Restore from backup (if needed)
fly postgres connect -a cliq-db -c "psql cliq_server < backup.sql"
``` 

Open the fly.toml file and remove the following line from the [env] section:
  FLY_SCALE_TO_ZERO = "1h"
Verify what image you’re running:
fly image show --app <app-name>
Finally, deploy your changes. For example:
fly deploy . --image flyio/postgres-flex:15.2