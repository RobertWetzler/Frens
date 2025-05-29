The fly.toml file in this dir corresponds to the cliq-db postgres app in fly.io.

Commands to use (From https://fly.io/docs/postgres/managing/scale-to-zero/)
fly config save --app 

Open the fly.toml file and remove the following line from the [env] section:
  FLY_SCALE_TO_ZERO = "1h"
Verify what image you’re running:
fly image show --app <app-name>
Finally, deploy your changes. For example:
fly deploy . --image flyio/postgres-flex:15.2