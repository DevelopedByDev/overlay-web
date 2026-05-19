/** Client-safe session shapes (no WorkOS / Node APIs). */

export interface AuthUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  profilePictureUrl?: string
  emailVerified: boolean
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  user: AuthUser
  expiresAt: number
}
