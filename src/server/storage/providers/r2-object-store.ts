import 'server-only'

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  getR2BucketName,
  getR2Client,
  getR2PresignTtlSeconds,
} from '@/server/storage/r2'
import type { ObjectStore, ObjectSummary } from '@overlay/app-core'

export class R2ObjectStore implements ObjectStore {
  async getUploadUrl(
    key: string,
    contentType: string,
  ): Promise<{ url: string; fields?: Record<string, string> }> {
    const url = await getSignedUrl(
      getR2Client(),
      new PutObjectCommand({
        Bucket: getR2BucketName(),
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: getR2PresignTtlSeconds() },
    )
    return { url }
  }

  async getDownloadUrl(key: string): Promise<string> {
    return await getSignedUrl(
      getR2Client(),
      new GetObjectCommand({
        Bucket: getR2BucketName(),
        Key: key,
      }),
      { expiresIn: getR2PresignTtlSeconds() },
    )
  }

  async deleteObject(key: string): Promise<void> {
    await getR2Client().send(
      new DeleteObjectCommand({
        Bucket: getR2BucketName(),
        Key: key,
      }),
    )
  }

  async listObjects(prefix: string): Promise<ObjectSummary[]> {
    const out: ObjectSummary[] = []
    let ContinuationToken: string | undefined

    do {
      const page = await getR2Client().send(
        new ListObjectsV2Command({
          Bucket: getR2BucketName(),
          Prefix: prefix,
          ContinuationToken,
        }),
      )

      for (const item of page.Contents ?? []) {
        if (!item.Key) continue
        out.push({
          key: item.Key,
          sizeBytes: item.Size,
          lastModified: item.LastModified?.toISOString(),
          etag: item.ETag,
        })
      }

      ContinuationToken = page.NextContinuationToken
    } while (ContinuationToken)

    return out
  }
}
