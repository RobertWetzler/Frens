# Local Object Storage (Mock Backblaze)

We use Backblaze B2 (S3 compatible) in production. For local development we spin up a MinIO container to fully exercise the same upload code paths without hitting external services.

## Services

Docker compose now includes:

minio (API): http://localhost:9000
minio console: http://localhost:9001 (login with cliq_local_key / cliq_local_secret_ChangeMe123)

## Bucket

The init container creates a private bucket named `cliq-private` and removes anonymous access.

## Configuration

`appsettings.Development.json` contains a Backblaze section that points to MinIO. Production overrides should come from environment variables:

```
Backblaze:ServiceUrl
Backblaze:KeyId
Backblaze:ApplicationKey
Backblaze:Bucket
```

## Privacy Model

Images are stored with private ACL and an internal object key only. The API never returns raw storage URLs directly in feed responses—only a boolean `HasImage`. A future endpoint will issue short-lived signed URLs after per-request authorization.

## Testing Upload

1. Start stack:
   docker compose up -d db minio minio-init
2. Run API (dotnet run or your usual method).
3. POST multipart form-data to `/api/post` with fields:
   - `text`: string
   - `circleIds`: can repeat or send none
   - `image`: the file

Example (HTTPie):
```
http -f POST :5188/api/post Authorization:"Bearer <token>" text='Hello' image@./test.png
```

4. Confirm object in MinIO console under `cliq-private/users/<userid>/posts/...`

## Next Steps (Not Yet Implemented)

- Endpoint to return expiring signed URL `GET /api/post/{id}/image` with auth checks
- Optional image resizing / format normalization
- Virus / content scanning hook

## Troubleshooting

- 403 errors: ensure bucket exists and credentials match.
- Preflight CORS issues (future when adding client access): configure MinIO CORS JSON.
