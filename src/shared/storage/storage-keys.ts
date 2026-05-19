function sanitizeStorageName(name: string): string {
  return encodeURIComponent(name).replace(/%20/g, '+')
}

export function fileKeyPrefixForUser(userId: string): string {
  return `users/${userId}/files/`
}

export function outputKeyPrefixForUser(userId: string): string {
  return `users/${userId}/outputs/`
}

export function keyForFile(userId: string, fileId: string, filename: string): string {
  return `${fileKeyPrefixForUser(userId)}${fileId}/${sanitizeStorageName(filename)}`
}

export function keyForOutput(userId: string, outputId: string, filename: string): string {
  return `${outputKeyPrefixForUser(userId)}${outputId}/${sanitizeStorageName(filename)}`
}

export function isOwnedFileR2Key(userId: string, key: string): boolean {
  return key.trim().startsWith(fileKeyPrefixForUser(userId))
}

export function isOwnedOutputR2Key(userId: string, key: string): boolean {
  return key.trim().startsWith(outputKeyPrefixForUser(userId))
}

export function assertOwnedFileR2Key(userId: string, key: string): void {
  if (!isOwnedFileR2Key(userId, key)) {
    throw new Error('Invalid file storage key for user')
  }
}

export function assertOwnedOutputR2Key(userId: string, key: string): void {
  if (!isOwnedOutputR2Key(userId, key)) {
    throw new Error('Invalid output storage key for user')
  }
}
