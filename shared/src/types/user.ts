// User-related types shared across services

import { UserRole, UserStatus, AccountVisibility, Gender } from './common.js'

export interface User {
  id: string
  email: string
  username: string
  displayName?: string
  firstName?: string
  lastName?: string
  bio?: string
  website?: string
  location?: string
  gender?: Gender
  dateOfBirth?: Date
  avatarUrl?: string
  coverImageUrl?: string
  role: UserRole
  status: UserStatus
  visibility: AccountVisibility
  isPrivate: boolean
  isEmailVerified: boolean
  followersCount: number
  followingCount: number
  postsCount: number
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
  lastActiveAt?: Date
}

export interface CreateUserData {
  email: string
  username: string
  password: string
  firstName?: string
  lastName?: string
  displayName?: string
  bio?: string
  website?: string
  location?: string
  gender?: Gender
  dateOfBirth?: Date
  role?: UserRole
  status?: UserStatus
  visibility?: AccountVisibility
  isPrivate?: boolean
}

export interface UpdateUserData {
  firstName?: string
  lastName?: string
  displayName?: string
  bio?: string
  website?: string
  location?: string
  gender?: Gender
  dateOfBirth?: Date
  avatarUrl?: string
  coverImageUrl?: string
  visibility?: AccountVisibility
  isPrivate?: boolean
  allowMessages?: boolean
  allowTagging?: boolean
  showOnlineStatus?: boolean
}

export interface UserFilters {
  role?: UserRole
  status?: UserStatus
  visibility?: AccountVisibility
  isPrivate?: boolean
  isEmailVerified?: boolean
  gender?: Gender
  dateFrom?: Date
  dateTo?: Date
  search?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  refreshExpiresAt: Date
}

export interface JWTPayload {
  id: string
  email: string
  username: string
  role: UserRole
  status: UserStatus
}

export interface LoginData {
  emailOrUsername: string
  password: string
  deviceInfo?: any
  ipAddress?: string
  userAgent?: string
}

export interface RegisterData extends CreateUserData {}

export interface UserSession {
  id: string
  deviceInfo?: any
  ipAddress?: string
  userAgent?: string
  createdAt: Date
  lastUsedAt?: Date
  expiresAt: Date
  isActive: boolean
}

export interface UserPreference {
  id: string
  userId: string
  theme: string
  language: string
  timezone: string
  dateFormat: string
  timeFormat: string
  emailNotifications: boolean
  pushNotifications: boolean
  smsNotifications: boolean
  marketingEmails: boolean
  profileVisibility: AccountVisibility
  activityVisibility: AccountVisibility
  showEmail: boolean
  showLocation: boolean
  allowDataCollection: boolean
  createdAt: Date
  updatedAt: Date
}

export interface FollowRelationship {
  id: string
  followerId: string
  followingId: string
  status: string
  followType: string
  createdAt: Date
  follower?: User
  following?: User
}

export interface SocialProfile {
  id: string
  userId: string
  bio?: string
  website?: string
  location?: string
  avatarUrl?: string
  coverImageUrl?: string
  followersCount: number
  followingCount: number
  postsCount: number
  isVerified: boolean
  isPrivate: boolean
  lastSyncAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface ModerationProfile {
  id: string
  userId: string
  trustScore: number
  warningCount: number
  suspensionCount: number
  banCount: number
  lastWarningAt?: Date
  lastSuspensionAt?: Date
  lastBanAt?: Date
  isModerator: boolean
  isAdmin: boolean
  moderatorLevel: number
  lastSyncAt?: Date
  createdAt: Date
  updatedAt: Date
}

// Event types for inter-service communication
export interface UserCreatedEvent {
  type: 'user.created'
  userId: string
  email: string
  username: string
  role: UserRole
  timestamp: string
}

export interface UserUpdatedEvent {
  type: 'user.updated'
  userId: string
  changes: Partial<User>
  timestamp: string
}

export interface UserDeletedEvent {
  type: 'user.deleted'
  userId: string
  email: string
  username: string
  timestamp: string
}

export interface FollowCreatedEvent {
  type: 'follow.created'
  followId: string
  followerId: string
  followingId: string
  timestamp: string
}

export interface FollowRemovedEvent {
  type: 'follow.removed'
  followerId: string
  followingId: string
  timestamp: string
}

export type UserEvent =
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent
  | FollowCreatedEvent
  | FollowRemovedEvent
