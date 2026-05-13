// @enterprise-future — storage provider implementations for S3-compatible backends.

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { IStorage } from './interface'

export interface S3CompatibleStorageOptions {
  providerId: 'r2' | 's3' | 'minio'
  bucket: string
  endpoint?: string
  region?: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle?: boolean
  publicBaseUrl?: string
  presignTtlSeconds?: number
}

export class S3CompatibleStorage implements IStorage {
  readonly providerId: string
  private readonly client: S3Client
  private readonly bucket: string
  private readonly publicBaseUrl?: string
  private readonly presignTtlSeconds: number

  constructor(options: S3CompatibleStorageOptions) {
    this.providerId = options.providerId
    this.bucket = options.bucket
    this.publicBaseUrl = options.publicBaseUrl?.replace(/\/$/, '')
    this.presignTtlSeconds = options.presignTtlSeconds ?? 900
    this.client = new S3Client({
      region: options.region ?? (options.providerId === 'r2' ? 'auto' : 'us-east-1'),
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle ?? options.providerId === 'minio',
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    })
  }

  async health(): Promise<{ ok: boolean; message?: string; latencyMs?: number }> {
    const start = Date.now()
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
    return { ok: true, latencyMs: Date.now() - start }
  }

  async upload(key: string, data: Buffer | Uint8Array | string, contentType: string): Promise<string> {
    const sizeBytes = typeof data === 'string' ? Buffer.byteLength(data) : data.byteLength
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      ContentLength: sizeBytes,
    }))
    return key
  }

  async download(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    const chunks: Uint8Array[] = []
    const body = result.Body
    if (!body || typeof (body as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] !== 'function') {
      throw new Error(`Storage object ${key} did not return a readable body.`)
    }
    for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(chunk)
    return Buffer.concat(chunks)
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return
    const batchSize = 1000
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize)
      await this.client.send(new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }))
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await this.head(key)) !== null
  }

  async head(key: string): Promise<{ sizeBytes: number; contentType?: string } | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return {
        sizeBytes: result.ContentLength ?? 0,
        contentType: result.ContentType,
      }
    } catch (error) {
      const name = (error as { name?: string })?.name
      if (name === 'NotFound' || name === 'NoSuchKey') return null
      throw error
    }
  }

  async getPresignedUploadUrl(key: string, contentType: string, expiresSeconds?: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: expiresSeconds ?? this.presignTtlSeconds },
    )
  }

  async getPresignedDownloadUrl(key: string, expiresSeconds?: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresSeconds ?? this.presignTtlSeconds },
    )
  }

  getPresignedUrl(key: string, expiresSeconds: number): Promise<string> {
    return this.getPresignedDownloadUrl(key, expiresSeconds)
  }

  async getPublicUrl(key: string): Promise<string | null> {
    return this.publicBaseUrl ? `${this.publicBaseUrl}/${encodeURI(key)}` : null
  }

  async list(prefix: string): Promise<string[]> {
    const out: string[] = []
    let ContinuationToken: string | undefined
    do {
      const result = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken,
      }))
      for (const object of result.Contents ?? []) {
        if (object.Key) out.push(object.Key)
      }
      ContinuationToken = result.NextContinuationToken
    } while (ContinuationToken)
    return out
  }
}

export class R2Storage extends S3CompatibleStorage {
  constructor(options: Omit<S3CompatibleStorageOptions, 'providerId'>) {
    super({ ...options, providerId: 'r2' })
  }
}

export class S3Storage extends S3CompatibleStorage {
  constructor(options: Omit<S3CompatibleStorageOptions, 'providerId'>) {
    super({ ...options, providerId: 's3' })
  }
}

export class MinIOStorage extends S3CompatibleStorage {
  constructor(options: Omit<S3CompatibleStorageOptions, 'providerId' | 'forcePathStyle'>) {
    super({ ...options, providerId: 'minio', forcePathStyle: true })
  }
}
