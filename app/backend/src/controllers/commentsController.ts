import { Request, Response } from 'express'
import { CommentsService } from '../services/commentsService.js'
import {
  createCommentSchema,
  updateCommentSchema,
  getCommentsSchema,
} from '../validators/socialValidators.js'
import { getUserId, handleControllerError } from '../utils/common.js'

// Create a new comment
const createComment = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const validatedData = createCommentSchema.parse(req.body)

    const comment = await CommentsService.createComment(userId, validatedData)

    res.status(201).json({
      message: 'Comment created successfully',
      comment,
    })
  } catch (error) {
    handleControllerError(error, res, 'createComment')
  }
}

// Update comment
const updateComment = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const commentId = parseInt(req.params.id)
    const validatedData = updateCommentSchema.parse(req.body)

    const comment = await CommentsService.updateComment(userId, commentId, validatedData)

    res.json({
      message: 'Comment updated successfully',
      comment,
    })
  } catch (error) {
    handleControllerError(error, res, 'updateComment')
  }
}

// Delete comment
const deleteComment = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const commentId = parseInt(req.params.id)

    await CommentsService.deleteComment(userId, commentId)

    res.json({
      message: 'Comment deleted successfully',
    })
  } catch (error) {
    handleControllerError(error, res, 'deleteComment')
  }
}

// Get comments with pagination and filtering
const getComments = async (req: Request, res: Response) => {
  try {
    const validatedData = getCommentsSchema.parse(req.query)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await CommentsService.getComments({
      ...validatedData,
      page,
      limit,
    })

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getComments')
  }
}

// Get comment by ID
const getCommentById = async (req: Request, res: Response) => {
  try {
    const commentId = parseInt(req.params.id)

    const comment = await CommentsService.getCommentById(commentId)

    res.json({ comment })
  } catch (error) {
    handleControllerError(error, res, 'getCommentById')
  }
}

// Get comments by post
const getCommentsByPost = async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.postId)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await CommentsService.getCommentsByPost(postId, page, limit)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getCommentsByPost')
  }
}

// Get comments by user
const getCommentsByUser = async (req: Request, res: Response) => {
  try {
    const authorId = parseInt(req.params.userId)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await CommentsService.getCommentsByUser(authorId, page, limit)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getCommentsByUser')
  }
}

// Get comment statistics
const getCommentStats = async (req: Request, res: Response) => {
  try {
    const postId = req.query.postId ? parseInt(req.query.postId as string) : undefined
    const authorId = req.query.authorId ? parseInt(req.query.authorId as string) : undefined

    const stats = await CommentsService.getCommentStats(postId, authorId)

    res.json({ stats })
  } catch (error) {
    handleControllerError(error, res, 'getCommentStats')
  }
}

export {
  createComment,
  updateComment,
  deleteComment,
  getComments,
  getCommentById,
  getCommentsByPost,
  getCommentsByUser,
  getCommentStats,
}
