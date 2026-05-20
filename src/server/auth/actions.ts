import 'server-only'

export {
  authenticateNativeWithCode,
  authenticateWithPassword,
  consumeAuthorizationState,
  createUser,
  getAuthorizationUrl,
  getBaseUrl,
  getNativeAuthorizationUrl,
  handleCallback,
  MOBILE_AUTH_REDIRECT_PATH,
  normalizeAuthRedirect,
  normalizeCodeChallenge,
  readEmailVerificationTicket,
  refreshSessionFromRefreshToken,
  resendVerificationEmail,
  resetPassword,
  sendPasswordResetEmail,
  verifyEmail,
} from '@/server/auth/workos-auth'
