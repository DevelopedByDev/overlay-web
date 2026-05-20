import 'server-only'

import type { ObjectStore, ObjectSummary } from '@overlay/app-core'

export class NoOpObjectStore implements ObjectStore {
  async getUploadUrl(
    key: string,
    contentType: string,
  ): Promise<{ url: string; fields?: Record<string, string> }> {
    void key
    void contentType
    return { url: 'about:blank' }
  }

  async getDownloadUrl(key: string): Promise<string> {
    void key
    return 'about:blank'
  }

  async deleteObject(key: string): Promise<void> {
    void key
  }

  async listObjects(prefix: string): Promise<ObjectSummary[]> {
    void prefix
    return []
  }
}
