import { Request, Response } from 'express'
import { SharesService } from '../services/sharesService.js'
import { createShareSchema, getSharesSchema } from '../validators/socialValidators.js'
import { getUserId, handleControllerError } from '../utils/common.js'

// Create a new share
const createShare = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const validatedData = createShareSchema.parse(req.body)

    const share = await SharesService.createShare(userId, validatedData)

    res.status(201).json({
      message: 'Post shared successfully',
      share,
    })
  } catch (error) {
    handleControllerError(error, res, 'createShare')
  }
}

// Delete share
const deleteShare = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const shareId = parseInt(req.params.id)

    await SharesService.deleteShare(userId, shareId)

    res.json({
      message: 'Share deleted successfully',
    })
  } catch (error) {
    handleControllerError(error, res, 'deleteShare')
  }
}

// Toggle share (create if doesn't exist, delete if exists)
const toggleShare = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const { postId, message } = req.body

    const result = await SharesService.toggleShare(userId, postId, message)

    res.json({
      message: `Post ${result.action} successfully`,
      action: result.action,
      share: result.share,
    })
  } catch (error) {
    handleControllerError(error, res, 'toggleShare')
  }
}

// Get shares with pagination and filtering
const getShares = async (req: Request, res: Response) => {
  try {
    const validatedData = getSharesSchema.parse(req.query)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await SharesService.getShares({
      ...validatedData,
      page,
      limit,
    })

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getShares')
  }
}

// Get share by ID
const getShareById = async (req: Request, res: Response) => {
  try {
    const shareId = parseInt(req.params.id)

    const share = await SharesService.getShareById(shareId)

    res.json({ share })
  } catch (error) {
    handleControllerError(error, res, 'getShareById')
  }
}

// Get shares by post
const getSharesByPost = async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.postId)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await SharesService.getSharesByPost(postId, page, limit)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getSharesByPost')
  }
}

// Get shares by user
const getSharesByUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await SharesService.getSharesByUser(userId, page, limit)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getSharesByUser')
  }
}

// Check if user has shared a post
const hasSharedPost = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const postId = parseInt(req.params.postId)

    const hasShared = await SharesService.hasSharedPost(userId, postId)

    res.json({ hasShared })
  } catch (error) {
    handleControllerError(error, res, 'hasSharedPost')
  }
}

// Get share statistics
const getShareStats = async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined
    const postId = req.query.postId ? parseInt(req.query.postId as string) : undefined

    const stats = await SharesService.getShareStats(userId, postId)

    res.json({ stats })
  } catch (error) {
    handleControllerError(error, res, 'getShareStats')
  }
}

export {
  createShare,
  deleteShare,
  toggleShare,
  getShares,
  getShareById,
  getSharesByPost,
  getSharesByUser,
  hasSharedPost,
  getShareStats,
}
