import jwt from 'jsonwebtoken'

interface Users {
  id: string
  username: string
  email: string
  password: string
  roles: string
}

const jwtSecret = process.env.JWT_SECRET as string
const expire = (process.env.JWT_EXPIRE as string) || '30d'

const generateToken = (users: Users) => {
  const token = jwt.sign(users, jwtSecret, { expiresIn: expire })
  return token
}

const validateToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, jwtSecret)
    return decoded
  } catch (error) {
    return null
  }
}

const refreshToken = (token: string) => {
  const decoded = jwt.verify(token, jwtSecret)
  const newToken = jwt.sign(decoded, jwtSecret, { expiresIn: expire })
  return newToken
}

export { generateToken, validateToken, refreshToken }
