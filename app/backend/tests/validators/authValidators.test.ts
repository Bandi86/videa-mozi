import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../../src/validators/authValidators.ts'

describe('Authentication Validators', () => {
  describe('registerSchema', () => {
    it('should validate valid registration data', () => {
      const validData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPass123!',
        confirmPassword: 'TestPass123!',
      }

      const result = registerSchema.parse(validData)
      expect(result).toEqual(validData)
    })

    it('should reject invalid username', () => {
      const invalidData = {
        username: 'us', // Too short
        email: 'test@example.com',
        password: 'TestPass123!',
        confirmPassword: 'TestPass123!',
      }

      expect(() => registerSchema.parse(invalidData)).toThrow()
    })

    it('should reject invalid email', () => {
      const invalidData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'TestPass123!',
        confirmPassword: 'TestPass123!',
      }

      expect(() => registerSchema.parse(invalidData)).toThrow()
    })

    it('should reject weak password', () => {
      const invalidData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'weak',
        confirmPassword: 'weak',
      }

      expect(() => registerSchema.parse(invalidData)).toThrow()
    })

    it('should reject mismatched passwords', () => {
      const invalidData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPass123!',
        confirmPassword: 'DifferentPass123!',
      }

      expect(() => registerSchema.parse(invalidData)).toThrow()
    })
  })

  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'TestPass123!',
      }

      const result = loginSchema.parse(validData)
      expect(result).toEqual(validData)
    })

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'TestPass123!',
      }

      expect(() => loginSchema.parse(invalidData)).toThrow()
    })

    it('should reject empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '',
      }

      expect(() => loginSchema.parse(invalidData)).toThrow()
    })
  })

  describe('refreshTokenSchema', () => {
    it('should validate valid refresh token', () => {
      const validData = {
        refreshToken: 'valid-refresh-token',
      }

      const result = refreshTokenSchema.parse(validData)
      expect(result).toEqual(validData)
    })

    it('should reject empty refresh token', () => {
      const invalidData = {
        refreshToken: '',
      }

      expect(() => refreshTokenSchema.parse(invalidData)).toThrow()
    })
  })

  describe('verifyEmailSchema', () => {
    it('should validate valid email verification token', () => {
      const validData = {
        token: 'valid-verification-token',
      }

      const result = verifyEmailSchema.parse(validData)
      expect(result).toEqual(validData)
    })

    it('should reject empty token', () => {
      const invalidData = {
        token: '',
      }

      expect(() => verifyEmailSchema.parse(invalidData)).toThrow()
    })
  })

  describe('forgotPasswordSchema', () => {
    it('should validate valid email', () => {
      const validData = {
        email: 'test@example.com',
      }

      const result = forgotPasswordSchema.parse(validData)
      expect(result).toEqual(validData)
    })

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
      }

      expect(() => forgotPasswordSchema.parse(invalidData)).toThrow()
    })
  })

  describe('resetPasswordSchema', () => {
    it('should validate valid reset password data', () => {
      const validData = {
        token: 'valid-reset-token',
        password: 'NewTestPass123!',
        confirmPassword: 'NewTestPass123!',
      }

      const result = resetPasswordSchema.parse(validData)
      expect(result).toEqual(validData)
    })

    it('should reject weak password', () => {
      const invalidData = {
        token: 'valid-reset-token',
        password: 'weak',
        confirmPassword: 'weak',
      }

      expect(() => resetPasswordSchema.parse(invalidData)).toThrow()
    })

    it('should reject mismatched passwords', () => {
      const invalidData = {
        token: 'valid-reset-token',
        password: 'NewTestPass123!',
        confirmPassword: 'DifferentPass123!',
      }

      expect(() => resetPasswordSchema.parse(invalidData)).toThrow()
    })
  })

  describe('changePasswordSchema', () => {
    it('should validate valid change password data', () => {
      const validData = {
        currentPassword: 'CurrentPass123!',
        newPassword: 'NewTestPass123!',
        confirmNewPassword: 'NewTestPass123!',
      }

      const result = changePasswordSchema.parse(validData)
      expect(result).toEqual(validData)
    })

    it('should reject weak new password', () => {
      const invalidData = {
        currentPassword: 'CurrentPass123!',
        newPassword: 'weak',
        confirmNewPassword: 'weak',
      }

      expect(() => changePasswordSchema.parse(invalidData)).toThrow()
    })

    it('should reject mismatched new passwords', () => {
      const invalidData = {
        currentPassword: 'CurrentPass123!',
        newPassword: 'NewTestPass123!',
        confirmNewPassword: 'DifferentPass123!',
      }

      expect(() => changePasswordSchema.parse(invalidData)).toThrow()
    })

    it('should reject empty current password', () => {
      const invalidData = {
        currentPassword: '',
        newPassword: 'NewTestPass123!',
        confirmNewPassword: 'NewTestPass123!',
      }

      expect(() => changePasswordSchema.parse(invalidData)).toThrow()
    })
  })
})
