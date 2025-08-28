import { Request, Response } from 'express'
import { LikesService } from '../services/likesService.js'
import { createLikeSchema, getLikesSchema } from '../validators/socialValidators.js'
import { getUserId, handleControllerError } from '../utils/common.js'

// Create a new like
const createLike = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const validatedData = createLikeSchema.parse(req.body)
    const { postId, commentId } = validatedData

    const like = await LikesService.createLike(userId, postId, commentId)

    res.status(201).json({
      message: 'Like created successfully',
      like,
    })
  } catch (error) {
    handleControllerError(error, res, 'createLike')
  }
}

// Delete like
const deleteLike = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const likeId = parseInt(req.params.id)

    await LikesService.deleteLike(userId, likeId)

    res.json({
      message: 'Like deleted successfully',
    })
  } catch (error) {
    handleControllerError(error, res, 'deleteLike')
  }
}

// Toggle like (create if doesn't exist, delete if exists)
const toggleLike = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const { postId, commentId } = req.body

    const result = await LikesService.toggleLike(userId, postId, commentId)

    res.json({
      message: `Like ${result.action} successfully`,
      action: result.action,
      like: result.like,
    })
  } catch (error) {
    handleControllerError(error, res, 'toggleLike')
  }
}

// Get likes with pagination and filtering
const getLikes = async (req: Request, res: Response) => {
  try {
    const validatedData = getLikesSchema.parse(req.query)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await LikesService.getLikes({
      ...validatedData,
      page,
      limit,
    })

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getLikes')
  }
}

// Get like by ID
const getLikeById = async (req: Request, res: Response) => {
  try {
    const likeId = parseInt(req.params.id)

    const like = await LikesService.getLikeById(likeId)

    res.json({ like })
  } catch (error) {
    handleControllerError(error, res, 'getLikeById')
  }
}

// Get likes by post
const getLikesByPost = async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.postId)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await LikesService.getLikesByPost(postId, page, limit)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getLikesByPost')
  }
}

// Get likes by user
const getLikesByUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await LikesService.getLikesByUser(userId, page, limit)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getLikesByUser')
  }
}

// Get like statistics
const getLikeStats = async (req: Request, res: Response) => {
  try {
    const postId = req.query.postId ? parseInt(req.query.postId as string) : undefined
    const commentId = req.query.commentId ? parseInt(req.query.commentId as string) : undefined
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined

    const stats = await LikesService.getLikeStats(postId, commentId, userId)

    res.json({ stats })
  } catch (error) {
    handleControllerError(error, res, 'getLikeStats')
  }
}

export {
  createLike,
  deleteLike,
  toggleLike,
  getLikes,
  getLikeById,
  getLikesByPost,
  getLikesByUser,
  getLikeStats,
}
