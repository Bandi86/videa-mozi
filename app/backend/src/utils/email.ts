import * as nodemailer from 'nodemailer'

// Email configuration interface
interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

// Create email transporter
const createTransporter = () => {
  const config: EmailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || '',
    },
  }

  return nodemailer.createTransport(config)
}

// Email templates
const emailTemplates = {
  emailVerification: (username: string, verificationLink: string) => ({
    subject: 'Verify Your Email - Videa Mozi',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center;">Welcome to Videa Mozi, ${username}!</h2>
        <p style="color: #666; line-height: 1.6;">
          Thank you for registering with Videa Mozi. To complete your registration and start using our platform,
          please verify your email address by clicking the button below:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}"
             style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #666; line-height: 1.6;">
          If the button doesn't work, you can also copy and paste this link into your browser:
        </p>
        <p style="word-break: break-all; color: #007bff;">
          ${verificationLink}
        </p>
        <p style="color: #999; font-size: 12px;">
          This link will expire in 24 hours. If you didn't create an account, please ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          Videa Mozi Team
        </p>
      </div>
    `,
  }),

  passwordReset: (username: string, resetLink: string) => ({
    subject: 'Password Reset - Videa Mozi',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
        <p style="color: #666; line-height: 1.6;">
          Hello ${username}, we received a request to reset your password for your Videa Mozi account.
        </p>
        <p style="color: #666; line-height: 1.6;">
          If you made this request, click the button below to reset your password:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}"
             style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; line-height: 1.6;">
          If the button doesn't work, you can also copy and paste this link into your browser:
        </p>
        <p style="word-break: break-all; color: #dc3545;">
          ${resetLink}
        </p>
        <p style="color: #999; font-size: 12px;">
          This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          Videa Mozi Team
        </p>
      </div>
    `,
  }),

  passwordChanged: (username: string) => ({
    subject: 'Password Changed - Videa Mozi',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center;">Password Changed Successfully</h2>
        <p style="color: #666; line-height: 1.6;">
          Hello ${username}, your password has been successfully changed.
        </p>
        <p style="color: #666; line-height: 1.6;">
          If you didn't make this change, please contact us immediately and consider changing your password again.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3031'}/login"
             style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Go to Login
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          Videa Mozi Team
        </p>
      </div>
    `,
  }),
}

// Send email function
export const sendEmail = async (
  to: string,
  template: keyof typeof emailTemplates,
  templateData: [string, string] | [string] | [],
): Promise<boolean> => {
  try {
    const transporter = createTransporter()

    let emailTemplate
    if (template === 'emailVerification' && templateData.length === 2) {
      emailTemplate = emailTemplates.emailVerification(templateData[0], templateData[1])
    } else if (template === 'passwordReset' && templateData.length === 2) {
      emailTemplate = emailTemplates.passwordReset(templateData[0], templateData[1])
    } else if (template === 'passwordChanged' && templateData.length === 1) {
      emailTemplate = emailTemplates.passwordChanged(templateData[0])
    } else {
      throw new Error('Invalid template or template data')
    }

    const mailOptions = {
      from: `"Videa Mozi" <${process.env.EMAIL_USER}>`,
      to,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('Email sent successfully:', info.messageId)
    return true
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}

// Specific email functions
export const sendEmailVerification = async (
  email: string,
  username: string,
  verificationToken: string,
): Promise<boolean> => {
  const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3031'}/verify-email?token=${verificationToken}`
  return await sendEmail(email, 'emailVerification', [username, verificationLink])
}

export const sendPasswordReset = async (
  email: string,
  username: string,
  resetToken: string,
): Promise<boolean> => {
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3031'}/reset-password?token=${resetToken}`
  return await sendEmail(email, 'passwordReset', [username, resetLink])
}

export const sendPasswordChangedNotification = async (
  email: string,
  username: string,
): Promise<boolean> => {
  return await sendEmail(email, 'passwordChanged', [username])
}

// Test email configuration
export const testEmailConnection = async (): Promise<boolean> => {
  try {
    const transporter = createTransporter()
    await transporter.verify()
    console.log('Email server connection successful')
    return true
  } catch (error) {
    console.error('Email server connection failed:', error)
    return false
  }
}
