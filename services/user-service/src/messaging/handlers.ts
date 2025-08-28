// Message handlers for User Service
// Processes events from other services via RabbitMQ

import prisma from '../config/database.js'
import logger from '../config/logger.js'
import { logBusinessEvent } from '../config/logger.js'
import {
  ServiceEvent,
  UserFollowedEvent,
  UserUnfollowedEvent,
  PostCreatedEvent,
  LikeCreatedEvent,
  LikeRemovedEvent,
  ReportCreatedEvent,
  UserSuspendedEvent,
  UserUnsuspendedEvent,
} from '../../../../shared/src/messaging/events.js'

// Update user's social statistics
async function updateUserSocialStats(userId: string): Promise<void> {
  try {
    // Get follower count
    const followerCount = await prisma.follow.count({
      where: { followingId: userId },
    })

    // Get following count
    const followingCount = await prisma.follow.count({
      where: { followerId: userId },
    })

    // Update user stats
    await prisma.user.update({
      where: { id: userId },
      data: {
        followersCount: followerCount,
        followingCount: followingCount,
      },
    })

    logger.debug(
      `Updated social stats for user ${userId}: ${followerCount} followers, ${followingCount} following`,
    )
  } catch (error) {
    logger.error(`Failed to update social stats for user ${userId}:`, error)
  }
}

// Update user's post statistics
async function updateUserPostStats(userId: string): Promise<void> {
  try {
    // This would be called when receiving events from Social Service
    // For now, we'll just log the event
    logger.debug(`Received post stats update request for user ${userId}`)

    // In a real implementation, you might want to cache or store
    // some post statistics from the Social Service
    logBusinessEvent('user_post_stats_updated', {
      userId,
      source: 'social-service',
    })
  } catch (error) {
    logger.error(`Failed to update post stats for user ${userId}:`, error)
  }
}

// Handle follow created event from Social Service
export async function handleFollowCreated(event: UserFollowedEvent): Promise<void> {
  const { followerId, followingId } = event.data

  try {
    logger.info(`Processing follow created: ${followerId} -> ${followingId}`)

    // Verify the follow exists in our database (it should be created via API)
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    })

    if (!follow) {
      logger.warn(`Follow relationship not found: ${followerId} -> ${followingId}`)
      return
    }

    // Update social statistics for both users
    await Promise.all([updateUserSocialStats(followerId), updateUserSocialStats(followingId)])

    logBusinessEvent('follow_created_processed', {
      followerId,
      followingId,
      eventId: event.eventId,
    })
  } catch (error) {
    logger.error(`Failed to handle follow created event:`, error)
    throw error
  }
}

// Handle unfollow event from Social Service
export async function handleFollowRemoved(event: UserUnfollowedEvent): Promise<void> {
  const { followerId, followingId } = event.data

  try {
    logger.info(`Processing follow removed: ${followerId} -> ${followingId}`)

    // Verify the follow no longer exists
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    })

    if (follow) {
      logger.warn(`Follow relationship still exists: ${followerId} -> ${followingId}`)
      return
    }

    // Update social statistics for both users
    await Promise.all([updateUserSocialStats(followerId), updateUserSocialStats(followingId)])

    logBusinessEvent('follow_removed_processed', {
      followerId,
      followingId,
      eventId: event.eventId,
    })
  } catch (error) {
    logger.error(`Failed to handle follow removed event:`, error)
    throw error
  }
}

// Handle post created event from Social Service
export async function handlePostCreated(event: PostCreatedEvent): Promise<void> {
  const { postId, authorId } = event.data

  try {
    logger.info(`Processing post created: ${postId} by ${authorId}`)

    // Update user's post statistics
    await updateUserPostStats(authorId)

    logBusinessEvent('post_created_processed', {
      postId,
      authorId,
      eventId: event.eventId,
    })
  } catch (error) {
    logger.error(`Failed to handle post created event:`, error)
    throw error
  }
}

// Handle like created event from Social Service
export async function handleLikeCreated(event: LikeCreatedEvent): Promise<void> {
  const { userId, targetId, targetType } = event.data

  try {
    logger.info(`Processing like created: ${userId} liked ${targetType} ${targetId}`)

    // Here you might want to update user activity stats
    // or maintain a cache of recent likes

    logBusinessEvent('like_created_processed', {
      userId,
      targetId,
      targetType,
      eventId: event.eventId,
    })
  } catch (error) {
    logger.error(`Failed to handle like created event:`, error)
    throw error
  }
}

// Handle like removed event from Social Service
export async function handleLikeRemoved(event: LikeRemovedEvent): Promise<void> {
  const { userId, targetId, targetType } = event.data

  try {
    logger.info(`Processing like removed: ${userId} unliked ${targetType} ${targetId}`)

    logBusinessEvent('like_removed_processed', {
      userId,
      targetId,
      targetType,
      eventId: event.eventId,
    })
  } catch (error) {
    logger.error(`Failed to handle like removed event:`, error)
    throw error
  }
}

// Handle report created event from Moderation Service
export async function handleReportCreated(event: ReportCreatedEvent): Promise<void> {
  const { reporterId, targetId, targetType, type, reason } = event.data

  try {
    logger.info(`Processing report created: ${reporterId} reported ${targetType} ${targetId}`)

    // Here you might want to:
    // 1. Update user's trust score
    // 2. Flag the user for review
    // 3. Send notifications to moderators

    logBusinessEvent('report_created_processed', {
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

    // Update user status in our database
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'SUSPENDED',
      },
    })

    // Invalidate all user sessions
    await prisma.authSession.updateMany({
      where: { userId },
      data: { isActive: false },
    })

    logBusinessEvent('user_suspended_processed', {
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

    // Update user status in our database
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
      },
    })

    logBusinessEvent('user_unsuspended_processed', {
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
export async function handleUserServiceEvent(event: ServiceEvent): Promise<void> {
  try {
    logger.info(`Received event in User Service: ${event.eventType}`)

    switch (event.eventType) {
      case 'social.follow.created':
        await handleFollowCreated(event as UserFollowedEvent)
        break

      case 'social.follow.removed':
        await handleFollowRemoved(event as UserUnfollowedEvent)
        break

      case 'social.post.created':
        await handlePostCreated(event as PostCreatedEvent)
        break

      case 'social.like.created':
        await handleLikeCreated(event as LikeCreatedEvent)
        break

      case 'social.like.removed':
        await handleLikeRemoved(event as LikeRemovedEvent)
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
        logger.warn(`Unhandled event type in User Service: ${event.eventType}`)
    }
  } catch (error) {
    logger.error(`Error handling event ${event.eventType}:`, error)
    throw error
  }
}
