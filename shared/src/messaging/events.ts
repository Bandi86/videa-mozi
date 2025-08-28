// Event types for inter-service communication
// These events are published to RabbitMQ and consumed by other services

import { UserRole, UserStatus, AccountVisibility } from '../types/common.js'

// Base event interface
export interface BaseEvent {
  eventId: string
  eventType: string
  timestamp: string
  source: string
  version: string
}

// User Service Events
export interface UserCreatedEvent extends BaseEvent {
  eventType: 'user.created'
  data: {
    userId: string
    email: string
    username: string
    displayName?: string
    role: UserRole
    status: UserStatus
    visibility: AccountVisibility
    createdAt: string
  }
}

export interface UserUpdatedEvent extends BaseEvent {
  eventType: 'user.updated'
  data: {
    userId: string
    changes: Partial<{
      displayName: string
      bio: string
      avatarUrl: string
      visibility: AccountVisibility
      status: UserStatus
    }>
    updatedAt: string
  }
}

export interface UserDeletedEvent extends BaseEvent {
  eventType: 'user.deleted'
  data: {
    userId: string
    email: string
    username: string
    deletedAt: string
  }
}

export interface UserFollowedEvent extends BaseEvent {
  eventType: 'user.followed'
  data: {
    followerId: string
    followingId: string
    createdAt: string
  }
}

export interface UserUnfollowedEvent extends BaseEvent {
  eventType: 'user.unfollowed'
  data: {
    followerId: string
    followingId: string
    createdAt: string
  }
}

// Content Service Events
export interface MovieCreatedEvent extends BaseEvent {
  eventType: 'content.movie.created'
  data: {
    movieId: string
    title: string
    genre: string
    releaseDate?: string
    createdBy: string
    createdAt: string
  }
}

export interface MovieUpdatedEvent extends BaseEvent {
  eventType: 'content.movie.updated'
  data: {
    movieId: string
    changes: Partial<{
      title: string
      description: string
      rating: number
      genre: string
    }>
    updatedAt: string
  }
}

export interface SeriesCreatedEvent extends BaseEvent {
  eventType: 'content.series.created'
  data: {
    seriesId: string
    title: string
    genre: string
    firstAirDate?: string
    createdBy: string
    createdAt: string
  }
}

export interface ContentLikedEvent extends BaseEvent {
  eventType: 'content.liked'
  data: {
    contentId: string
    contentType: 'movie' | 'series'
    userId: string
    createdAt: string
  }
}

export interface ContentUnlikedEvent extends BaseEvent {
  eventType: 'content.unliked'
  data: {
    contentId: string
    contentType: 'movie' | 'series'
    userId: string
    createdAt: string
  }
}

// Social Service Events
export interface PostCreatedEvent extends BaseEvent {
  eventType: 'social.post.created'
  data: {
    postId: string
    authorId: string
    content: string
    type: string
    visibility: string
    createdAt: string
  }
}

export interface PostUpdatedEvent extends BaseEvent {
  eventType: 'social.post.updated'
  data: {
    postId: string
    authorId: string
    changes: Partial<{
      content: string
      visibility: string
    }>
    updatedAt: string
  }
}

export interface PostDeletedEvent extends BaseEvent {
  eventType: 'social.post.deleted'
  data: {
    postId: string
    authorId: string
    deletedAt: string
  }
}

export interface CommentCreatedEvent extends BaseEvent {
  eventType: 'social.comment.created'
  data: {
    commentId: string
    postId: string
    authorId: string
    content: string
    createdAt: string
  }
}

export interface LikeCreatedEvent extends BaseEvent {
  eventType: 'social.like.created'
  data: {
    likeId: string
    userId: string
    targetId: string
    targetType: 'post' | 'comment'
    createdAt: string
  }
}

export interface LikeRemovedEvent extends BaseEvent {
  eventType: 'social.like.removed'
  data: {
    userId: string
    targetId: string
    targetType: 'post' | 'comment'
    createdAt: string
  }
}

export interface FollowCreatedEvent extends BaseEvent {
  eventType: 'social.follow.created'
  data: {
    followId: string
    followerId: string
    followingId: string
    createdAt: string
  }
}

export interface FollowRemovedEvent extends BaseEvent {
  eventType: 'social.follow.removed'
  data: {
    followerId: string
    followingId: string
    createdAt: string
  }
}

// Moderation Service Events
export interface ReportCreatedEvent extends BaseEvent {
  eventType: 'moderation.report.created'
  data: {
    reportId: string
    reporterId: string
    targetId?: string
    targetType?: 'user' | 'post' | 'comment' | 'content'
    type: string
    reason: string
    status: string
    createdAt: string
  }
}

export interface ReportResolvedEvent extends BaseEvent {
  eventType: 'moderation.report.resolved'
  data: {
    reportId: string
    moderatorId: string
    resolution: string
    resolvedAt: string
  }
}

export interface UserSuspendedEvent extends BaseEvent {
  eventType: 'moderation.user.suspended'
  data: {
    userId: string
    moderatorId: string
    reason: string
    suspensionEnd?: string
    suspendedAt: string
  }
}

export interface UserUnsuspendedEvent extends BaseEvent {
  eventType: 'moderation.user.unsuspended'
  data: {
    userId: string
    moderatorId: string
    unsuspendedAt: string
  }
}

// Media Service Events
export interface MediaUploadedEvent extends BaseEvent {
  eventType: 'media.uploaded'
  data: {
    mediaId: string
    filename: string
    originalName: string
    mimeType: string
    size: number
    url: string
    uploadedBy: string
    createdAt: string
  }
}

export interface MediaProcessedEvent extends BaseEvent {
  eventType: 'media.processed'
  data: {
    mediaId: string
    processedUrl: string
    thumbnailUrl?: string
    processingTime: number
    processedAt: string
  }
}

export interface MediaDeletedEvent extends BaseEvent {
  eventType: 'media.deleted'
  data: {
    mediaId: string
    deletedBy: string
    deletedAt: string
  }
}

// Union type for all events
export type ServiceEvent =
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent
  | UserFollowedEvent
  | UserUnfollowedEvent
  | MovieCreatedEvent
  | MovieUpdatedEvent
  | SeriesCreatedEvent
  | ContentLikedEvent
  | ContentUnlikedEvent
  | PostCreatedEvent
  | PostUpdatedEvent
  | PostDeletedEvent
  | CommentCreatedEvent
  | LikeCreatedEvent
  | LikeRemovedEvent
  | FollowCreatedEvent
  | FollowRemovedEvent
  | ReportCreatedEvent
  | ReportResolvedEvent
  | UserSuspendedEvent
  | UserUnsuspendedEvent
  | MediaUploadedEvent
  | MediaProcessedEvent
  | MediaDeletedEvent

// Event routing configuration
export const EVENT_ROUTES = {
  // User events - consumed by Social, Moderation, Content services
  'user.created': ['social-service', 'moderation-service', 'content-service'],
  'user.updated': ['social-service', 'moderation-service', 'content-service'],
  'user.deleted': ['social-service', 'moderation-service', 'content-service'],
  'user.followed': ['social-service'],
  'user.unfollowed': ['social-service'],

  // Content events - consumed by Social service
  'content.movie.created': ['social-service'],
  'content.movie.updated': ['social-service'],
  'content.series.created': ['social-service'],
  'content.liked': ['social-service'],
  'content.unliked': ['social-service'],

  // Social events - consumed by Moderation, User services
  'social.post.created': ['moderation-service', 'user-service'],
  'social.post.updated': ['moderation-service'],
  'social.post.deleted': ['moderation-service'],
  'social.comment.created': ['moderation-service'],
  'social.like.created': ['user-service'],
  'social.like.removed': ['user-service'],
  'social.follow.created': ['user-service'],
  'social.follow.removed': ['user-service'],

  // Moderation events - consumed by User, Social services
  'moderation.report.created': ['user-service', 'social-service'],
  'moderation.report.resolved': ['user-service', 'social-service'],
  'moderation.user.suspended': ['user-service', 'social-service'],
  'moderation.user.unsuspended': ['user-service', 'social-service'],

  // Media events - consumed by Content, Social services
  'media.uploaded': ['content-service', 'social-service'],
  'media.processed': ['content-service', 'social-service'],
  'media.deleted': ['content-service', 'social-service'],
} as const

// Dead letter queue configuration
export const DEAD_LETTER_EXCHANGE = 'dead-letter-exchange'
export const DEAD_LETTER_QUEUE = 'dead-letter-queue'

// Retry configuration
export const RETRY_EXCHANGE = 'retry-exchange'
export const RETRY_QUEUE = 'retry-queue'
export const MAX_RETRIES = 3
export const RETRY_DELAY_MS = 5000
