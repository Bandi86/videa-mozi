// Message handlers for Social Service
// Processes events from other services via RabbitMQ

import prisma from '../config/database.js'
import logger from '../config/logger.js'
// import { logBusinessEvent } from '../config/logger.js' // Not available
import {
  ServiceEvent,
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
  MovieCreatedEvent,
  MovieUpdatedEvent,
  SeriesCreatedEvent,
  ContentLikedEvent,
  ContentUnlikedEvent,
  ReportCreatedEvent,
  UserSuspendedEvent,
  UserUnsuspendedEvent,
} from '../../../../shared/src/messaging/events.js'

// Sync user data from User Service
async function syncUserData(userId: string): Promise<void> {
  try {
    // In a real implementation, you would fetch user data from User Service
    // For now, we'll just log the sync request
    logger.debug(`Received user sync request for user ${userId}`)

    logger.info('BUSINESS_EVENT: user_data_synced', {
      userId,
      source: 'social-service',
    })
  } catch (error) {
    logger.error(`Failed to sync user data for ${userId}:`, error)
  }
}

// Update content statistics
async function updateContentStats(
  contentId: string,
  contentType: 'movie' | 'series',
  action: 'like' | 'unlike',
): Promise<void> {
  try {
    // Here you might want to update cached content statistics
    logger.debug(`Updating ${contentType} ${contentId} stats for ${action}`)

    logger.info('BUSINESS_EVENT: content_stats_updated', {
      contentId,
      contentType,
      action,
      source: 'social-service',
    })
  } catch (error) {
    logger.error(`Failed to update content stats for ${contentId}:`, error)
  }
}

// Handle user created event from User Service
export async function handleUserCreated(event: UserCreatedEvent): Promise<void> {
  const { userId, username, displayName, role, status } = event.data

  try {
    logger.info(`Processing user created: ${username} (${userId})`)

    // Create or update user record in Social Service database
    await prisma.users.upsert({
      where: { id: userId },
      update: {
        username,
        displayName: displayName || username,
        role: role as any,
        status: status as any,
        lastSyncAt: new Date(),
      },
      create: {
        id: userId,
        username,
        displayName: displayName || username,
        role: role as any,
        status: status as any,
        lastSyncAt: new Date(),
      },
    })

    logger.info('BUSINESS_EVENT: user_created_processed', {
      userId,
      username,
      eventId: event.eventId,
    })
  } catch (error) {
    logger.error(`Failed to handle user created event:`, error)
    throw error
  }
}

// Handle user updated event from User Service
export async function handleUserUpdated(event: UserUpdatedEvent): Promise<void> {
  const { userId, changes } = event.data

  try {
    logger.info(`Processing user updated: ${userId}`)

    // Update user record in Social Service database
    const updateData: any = {
      lastSyncAt: new Date(),
    }

    if (changes.displayName) updateData.displayName = changes.displayName
    if (changes.avatarUrl) updateData.avatarUrl = changes.avatarUrl
    if (changes.bio) updateData.bio = changes.bio
    if (changes.visibility) updateData.visibility = changes.visibility
    if (changes.status) updateData.status = changes.status

    await prisma.users.update({
      where: { id: userId },
      data: updateData,
    })

    logger.info('BUSINESS_EVENT: user_updated_processed', {
      userId,
      changes: Object.keys(changes),
      eventId: event.eventId,
    })
  } catch (error) {
    logger.error(`Failed to handle user updated event:`, error)
    throw error
  }
}

// Handle user deleted event from User Service
export async function handleUserDeleted(event: UserDeletedEvent): Promise<void> {
  const { userId, email, username } = event.data

  try {
    logger.info(`Processing user deleted: ${username} (${userId})`)

    // Remove or deactivate user in Social Service
    await prisma.users.update({
      where: { id: userId },
      data: {
        status: 'DELETED',
        lastSyncAt: new Date(),
      },
    })

    logger.info('BUSINESS_EVENT: user_deleted_processed', {
      userId,
      email,
      username,
      eventId: event.eventId,
    })
  } catch (error) {
    logger.error(`Failed to handle user deleted event:`, error)
    throw error
  }
}

// Handle movie created event from Content Service
export async function handleMovieCreated(event: MovieCreatedEvent): Promise<void> {
  const { movieId, title, genre, createdBy } = event.data

  try {
    logger.info(`Processing movie created: ${title} (${movieId})`)

    // Here you might want to cache movie data or create activity feeds
    // For now, we'll just log the event

    logger.info('BUSINESS_EVENT: movie_created_processed', {
      movieId,
      title,
      genre,
      createdBy,
      eventId: event.eventId,
    })
  } catch (error) {
    logger.error(`Failed to handle movie created event:`, error)
    throw error
  }
}

// Handle series created event from Content Service
export async function handleSeriesCreated(event: SeriesCreatedEvent): Promise<void> {
  const { seriesId, title, genre, createdBy } = event.data

  try {
    logger.info(`Processing series created: ${title} (${seriesId})`)

    logger.info('BUSINESS_EVENT: series_created_processed', {
      seriesId,
      title,
      genre,
      createdBy,
      eventId: event.eventId,
    })
  } catch (error) {
    logger.error(`Failed to handle series created event:`, error)
    throw error
  }
}

// Handle content liked event from Content Service
export async function handleContentLiked(event: ContentLikedEvent): Promise<void> {
  const { contentId, contentType, userId } = event.data

  try {
    logger.info(`Processing content liked: ${contentType} ${contentId} by ${userId}`)

    await updateContentStats(contentId, contentType, 'like')

    logger.info('BUSINESS_EVENT: content_liked_processed', {
      contentId,
      contentType,
      userId,
      eventId: event.eventId,
    })
  } catch (error) {
    logger.error(`Failed to handle content liked event:`, error)
    throw error
  }
}

// Handle content unliked event from Content Service
export async function handleContentUnliked(event: ContentUnlikedEvent): Promise<void> {
  const { contentId, contentType, userId } = event.data

  try {
    logger.info(`Processing content unliked: ${contentType} ${contentId} by ${userId}`)

    await updateContentStats(contentId, contentType, 'unlike')

    logger.info('BUSINESS_EVENT: content_unliked_processed', {
      contentId,
      contentType,
      userId,
      eventId: event.eventId,
    })
  } catch (error) {
    logger.error(`Failed to handle content unliked event:`, error)
    throw error
  }
}

// Handle report created event from Moderation Service
export async function handleReportCreated(event: ReportCreatedEvent): Promise<void> {
  const { reporterId, targetId, targetType, type, reason } = event.data

  try {
    logger.info(`Processing report created: ${reporterId} reported ${targetType} ${targetId}`)

    // Here you might want to:
    // 1. Hide or moderate the reported content
    // 2. Send notifications to moderators
    // 3. Update content visibility

    logger.info('BUSINESS_EVENT: report_created_processed', {
      reporterId,
      targetId,
      targetType,
      type,
      reason,
      eventId: event.eventId,
    })
  } catch (error) {
    logger.error(`Failed to handle report created event:`, error)
    throw error
  }
}

// Handle user suspended event from Moderation Service
export async function handleUserSuspended(event: UserSuspendedEvent): Promise<void> {
  const { userId, moderatorId, reason, suspensionEnd } = event.data

  try {
    logger.info(`Processing user suspended: ${userId} suspended by ${moderatorId}`)

    // Update user status and restrict their activities
    await prisma.users.update({
      where: { id: userId },
      data: {
        status: 'SUSPENDED',
        lastSyncAt: new Date(),
      },
    })

    logger.info('BUSINESS_EVENT: user_suspended_processed', {
      userId,
      moderatorId,
      reason,
      suspensionEnd,
      eventId: event.eventId,
    })
  } catch (error) {
    logger.error(`Failed to handle user suspended event:`, error)
    throw error
  }
}

// Handle user unsuspended event from Moderation Service
export async function handleUserUnsuspended(event: UserUnsuspendedEvent): Promise<void> {
  const { userId, moderatorId } = event.data

  try {
    logger.info(`Processing user unsuspended: ${userId} unsuspended by ${moderatorId}`)

    // Restore user status
    await prisma.users.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        lastSyncAt: new Date(),
      },
    })

    logger.info('BUSINESS_EVENT: user_unsuspended_processed', {
      userId,
      moderatorId,
      eventId: event.eventId,
    })
  } catch (error) {
    logger.error(`Failed to handle user unsuspended event:`, error)
    throw error
  }
}

// Generic event handler that routes to specific handlers
export async function handleSocialServiceEvent(event: ServiceEvent): Promise<void> {
  try {
    logger.info(`Received event in Social Service: ${event.eventType}`)

    switch (event.eventType) {
      case 'user.created':
        await handleUserCreated(event as UserCreatedEvent)
        break

      case 'user.updated':
        await handleUserUpdated(event as UserUpdatedEvent)
        break

      case 'user.deleted':
        await handleUserDeleted(event as UserDeletedEvent)
        break

      case 'content.movie.created':
        await handleMovieCreated(event as MovieCreatedEvent)
        break

      case 'content.series.created':
        await handleSeriesCreated(event as SeriesCreatedEvent)
        break

      case 'content.liked':
        await handleContentLiked(event as ContentLikedEvent)
        break

      case 'content.unliked':
        await handleContentUnliked(event as ContentUnlikedEvent)
        break

      case 'moderation.report.created':
        await handleReportCreated(event as ReportCreatedEvent)
        break

      case 'moderation.user.suspended':
        await handleUserSuspended(event as UserSuspendedEvent)
        break

      case 'moderation.user.unsuspended':
        await handleUserUnsuspended(event as UserUnsuspendedEvent)
        break

      default:
        logger.warn(`Unhandled event type in Social Service: ${event.eventType}`)
    }
  } catch (error) {
    logger.error(`Error handling event ${event.eventType}:`, error)
    throw error
  }
}
