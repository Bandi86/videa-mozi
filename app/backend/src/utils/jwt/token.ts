import * as jwt from 'jsonwebtoken'
import * as crypto from 'crypto'

interface UserPayload {
  id: number
  username: string
  email: string
  roles: string
}

interface TokenPayload extends UserPayload {
  type: 'access' | 'refresh'
  iat?: number
  exp?: number
}

const jwtAccessSecret =
  process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'your-access-secret-key'
const jwtRefreshSecret =
  process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'your-refresh-secret-key'
const accessTokenExpire = (process.env.JWT_ACCESS_EXPIRE as string) || '15m'
const refreshTokenExpire = (process.env.JWT_REFRESH_EXPIRE as string) || '7d'

// Generate access token
const generateAccessToken = (user: UserPayload): string => {
  const payload: TokenPayload = {
    id: user.id,
    username: user.username,
    email: user.email,
    roles: user.roles,
    type: 'access',
  }
  return jwt.sign(payload, jwtAccessSecret, { expiresIn: accessTokenExpire })
}

// Generate refresh token
const generateRefreshToken = (user: UserPayload): string => {
  const payload: TokenPayload = {
    id: user.id,
    username: user.username,
    email: user.email,
    roles: user.roles,
    type: 'refresh',
  }
  return jwt.sign(payload, jwtRefreshSecret, { expiresIn: refreshTokenExpire })
}

// Verify access token
const verifyAccessToken = (token: string): TokenPayload | null => {
  try {
    const decoded = jwt.verify(token, jwtAccessSecret) as TokenPayload
    if (decoded.type !== 'access') return null
    return decoded
  } catch (error) {
    return null
  }
}

// Verify refresh token
const verifyRefreshToken = (token: string): TokenPayload | null => {
  try {
    const decoded = jwt.verify(token, jwtRefreshSecret) as TokenPayload
    if (decoded.type !== 'refresh') return null
    return decoded
  } catch (error) {
    return null
  }
}

// Generate email verification token (not JWT, just random string)
const generateEmailVerificationToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}

// Generate password reset token (not JWT, just random string)
const generatePasswordResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}

// Legacy functions for backward compatibility
const generateToken = (user: any) => generateAccessToken(user)
const validateToken = (token: string) => verifyAccessToken(token)
const refreshToken = (token: string) => {
  const decoded = verifyRefreshToken(token)
  if (!decoded) return null
  return generateAccessToken({
    id: decoded.id,
    username: decoded.username,
    email: decoded.email,
    roles: decoded.roles,
  })
}

export {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  // Legacy exports
  generateToken,
  validateToken,
  refreshToken,
}
