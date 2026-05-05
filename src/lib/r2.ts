import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'
export { keyForFile, keyForOutput } from './storage-keys'

function requireR2Env(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`[R2] Missing required env var: ${name}`)
  return value
}

function getR2Endpoint(): string {
  const configured = process.env['S3_API']?.trim()
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      return configured
    }
  }
  return `https://${requireR2Env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`
}

function getR2BucketName(): string {
  return requireR2Env('R2_BUCKET_NAME')
}

const MAX_PRESIGN_TTL_SECONDS = 900 // hard cap: 15 minutes

function getR2PresignTtl(): number {
  const configured = parseInt(process.env['R2_PRESIGN_TTL_SECONDS'] ?? String(MAX_PRESIGN_TTL_SECONDS), 10)
  return Math.min(Number.isFinite(configured) && configured > 0 ? configured : 300, MAX_PRESIGN_TTL_SECONDS)
}

export function createR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: getR2Endpoint(),
    credentials: {
      accessKeyId: requireR2Env('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireR2Env('R2_SECRET_ACCESS_KEY'),
    },
  })
}

let _client: S3Client | null = null
function getR2Client(): S3Client {
  if (!_client) _client = createR2Client()
  return _client
}

// ── Presigned upload URL ─────────────────────────────────────────────────────

export async function generatePresignedUploadUrl(
  key: string,
  mimeType: string,
  ttlSeconds?: number,
): Promise<string> {
  const client = getR2Client()
  const bucket = getR2BucketName()
  const ttl = ttlSeconds ?? getR2PresignTtl()
  const t0 = Date.now()

  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mimeType,
    }),
    { expiresIn: ttl },
  )

  console.log(`[R2] generatePresignedUploadUrl key=${key} mimeType=${mimeType} ttl=${ttl}s duration=${Date.now() - t0}ms`)
  return url
}

// ── Presigned download URL ───────────────────────────────────────────────────

export async function generatePresignedDownloadUrl(
  key: string,
  ttlSeconds?: number,
): Promise<string> {
  const client = getR2Client()
  const bucket = getR2BucketName()
  const ttl = ttlSeconds ?? getR2PresignTtl()
  const t0 = Date.now()

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: ttl },
  )

  console.log(`[R2] generatePresignedDownloadUrl key=${key} ttl=${ttl}s duration=${Date.now() - t0}ms`)
  return url
}

// ── Server-side buffer upload ────────────────────────────────────────────────

export async function uploadBuffer(
  key: string,
  body: Buffer | Uint8Array | string,
  mimeType: string,
): Promise<void> {
  const client = getR2Client()
  const bucket = getR2BucketName()
  const sizeBytes = typeof body === 'string' ? Buffer.byteLength(body) : body.byteLength
  const t0 = Date.now()

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    }),
  )

  console.log(`[R2] uploadBuffer key=${key} mimeType=${mimeType} size=${sizeBytes}B duration=${Date.now() - t0}ms`)
}

// ── Delete single object ─────────────────────────────────────────────────────

export async function deleteObject(key: string): Promise<void> {
  const client = getR2Client()
  const bucket = getR2BucketName()
  const t0 = Date.now()

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))

  console.log(`[R2] deleteObject key=${key} duration=${Date.now() - t0}ms`)
}

// ── Delete multiple objects (batch) ─────────────────────────────────────────

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return

  const client = getR2Client()
  const bucket = getR2BucketName()
  const t0 = Date.now()

  const BATCH_SIZE = 1000
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE)
    const result = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    )
    if (result.Errors && result.Errors.length > 0) {
      console.error(`[R2] deleteObjects partial errors: ${JSON.stringify(result.Errors)}`)
    }
  }

  console.log(`[R2] deleteObjects count=${keys.length} duration=${Date.now() - t0}ms`)
}

// ── Head object (check existence / metadata) ─────────────────────────────────

export async function headObject(key: string): Promise<{ sizeBytes: number; contentType: string | undefined } | null> {
  const client = getR2Client()
  const bucket = getR2BucketName()

  try {
    const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return {
      sizeBytes: res.ContentLength ?? 0,
      contentType: res.ContentType,
    }
  } catch (err: unknown) {
    const code = (err as { name?: string })?.name
    if (code === 'NotFound' || code === 'NoSuchKey') return null
    throw err
  }
}
