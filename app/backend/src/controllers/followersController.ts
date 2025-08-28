import { Request, Response } from 'express'
import { FollowersService } from '../services/followersService.js'
import {
  followUserSchema,
  getFollowersSchema,
  getFollowingSchema,
} from '../validators/socialValidators.js'
import { getUserId, handleControllerError } from '../utils/common.js'

// Follow a user
const followUser = async (req: Request, res: Response) => {
  try {
    const followerId = getUserId(req)
    const validatedData = followUserSchema.parse(req.body)
    const { followingId } = validatedData

    const follow = await FollowersService.followUser(followerId, followingId)

    res.status(201).json({
      message: 'User followed successfully',
      follow,
    })
  } catch (error) {
    handleControllerError(error, res, 'followUser')
  }
}

// Unfollow user
const unfollowUser = async (req: Request, res: Response) => {
  try {
    const followerId = getUserId(req)
    const followingId = parseInt(req.params.id)

    await FollowersService.unfollowUser(followerId, followingId)

    res.json({
      message: 'User unfollowed successfully',
    })
  } catch (error) {
    handleControllerError(error, res, 'unfollowUser')
  }
}

// Get followers
const getFollowers = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await FollowersService.getFollowers(userId, page, limit)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getFollowers')
  }
}

// Get following
const getFollowing = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await FollowersService.getFollowing(userId, page, limit)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getFollowing')
  }
}

// Get follower by ID
const getFollowerById = async (req: Request, res: Response) => {
  try {
    const followId = parseInt(req.params.id)

    const follow = await FollowersService.getFollowerById(followId)

    res.json({ follow })
  } catch (error) {
    handleControllerError(error, res, 'getFollowerById')
  }
}

// Get followers by user
const getFollowersByUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await FollowersService.getFollowersByUser(userId, page, limit)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getFollowersByUser')
  }
}

// Get following by user
const getFollowingByUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await FollowersService.getFollowingByUser(userId, page, limit)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getFollowingByUser')
  }
}

// Check if following
const isFollowing = async (req: Request, res: Response) => {
  try {
    const followerId = getUserId(req)
    const followingId = parseInt(req.params.userId)

    const following = await FollowersService.isFollowing(followerId, followingId)

    res.json({ isFollowing: following })
  } catch (error) {
    handleControllerError(error, res, 'isFollowing')
  }
}

// Get follow suggestions
const getFollowSuggestions = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const limit = parseInt(req.query.limit as string) || 10

    const suggestions = await FollowersService.getFollowSuggestions(userId, limit)

    res.json({ suggestions })
  } catch (error) {
    handleControllerError(error, res, 'getFollowSuggestions')
  }
}

// Get follower statistics
const getFollowerStats = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId)

    const stats = await FollowersService.getFollowerStats(userId)

    res.json({ stats })
  } catch (error) {
    handleControllerError(error, res, 'getFollowerStats')
  }
}

export {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowerById,
  getFollowersByUser,
  getFollowingByUser,
  isFollowing,
  getFollowSuggestions,
  getFollowerStats,
}
