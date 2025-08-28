import { Request, Response } from 'express'
import {
  createContentSchema,
  updateContentSchema,
  getContentSchema,
  createContentCommentSchema,
  updateContentCommentSchema,
  getContentCommentsSchema,
  createContentLikeSchema,
  getContentLikesSchema,
  createContentCommentLikeSchema,
  getContentCommentLikesSchema,
  createContentShareSchema,
  getContentSharesSchema,
  createContentReportSchema,
  updateContentReportSchema,
  getContentReportsSchema,
} from '../validators/contentValidators.js'
import { ContentService } from '../services/contentService.js'
import { ContentCommentsService } from '../services/contentCommentsService.js'
import { ContentLikesService } from '../services/contentLikesService.js'
import { ContentSharesService } from '../services/contentSharesService.js'
import { ContentReportsService } from '../services/contentReportsService.js'
import { getUserId, handleControllerError } from '../utils/common.js'

// ============================================================================
// CONTENT CRUD OPERATIONS
// ============================================================================

// Create new content (movie or series)
const createContent = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const validatedData = createContentSchema.parse(req.body)

    const content = await ContentService.createContent(userId, validatedData)

    res.status(201).json({
      message: 'Content created successfully',
      content,
    })
  } catch (error) {
    handleControllerError(error, res, 'create content', getUserId(req))
  }
}

// Update content
const updateContent = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const contentId = req.params.contentId
    const validatedData = updateContentSchema.parse(req.body)

    const content = await ContentService.updateContent(userId, contentId, validatedData)

    res.json({
      message: 'Content updated successfully',
      content,
    })
  } catch (error) {
    handleControllerError(error, res, 'update content', getUserId(req))
  }
}

// Get content with filters and pagination
const getContent = async (req: Request, res: Response) => {
  try {
    const validatedData = getContentSchema.parse(req.query)
    const result = await ContentService.getContent(validatedData)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'get content')
  }
}

// Get single content by ID
const getContentById = async (req: Request, res: Response) => {
  try {
    const contentId = req.params.contentId
    const content = await ContentService.getContentById(contentId)

    res.json({ content })
  } catch (error) {
    handleControllerError(error, res, 'get content by ID')
  }
}

// Delete content (soft delete - set status to DELETED)
const deleteContent = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const contentId = req.params.contentId

    await ContentService.deleteContent(userId, contentId)

    res.json({ message: 'Content deleted successfully' })
  } catch (error) {
    handleControllerError(error, res, 'delete content', getUserId(req))
  }
}

// ============================================================================
// CONTENT COMMENTS OPERATIONS
// ============================================================================

// Create content comment
const createContentComment = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const validatedData = createContentCommentSchema.parse(req.body)

    const comment = await ContentCommentsService.createComment(userId, validatedData)

    res.status(201).json({
      message: 'Comment created successfully',
      comment,
    })
  } catch (error) {
    handleControllerError(error, res, 'create comment', getUserId(req))
  }
}

// Update content comment
const updateContentComment = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const commentId = parseInt(req.params.commentId)
    const validatedData = updateContentCommentSchema.parse(req.body)

    const comment = await ContentCommentsService.updateComment(userId, commentId, validatedData)

    res.json({
      message: 'Comment updated successfully',
      comment,
    })
  } catch (error) {
    handleControllerError(error, res, 'update comment', getUserId(req))
  }
}

// Get content comments
const getContentComments = async (req: Request, res: Response) => {
  try {
    const validatedData = getContentCommentsSchema.parse(req.query)
    const result = await ContentCommentsService.getComments(validatedData)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'get comments')
  }
}

// Create content comment like
const createContentCommentLike = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const validatedData = createContentCommentLikeSchema.parse(req.body)

    const result = await ContentCommentsService.toggleCommentLike(userId, validatedData)

    res.status(result.liked ? 201 : 200).json(result)
  } catch (error) {
    handleControllerError(error, res, 'toggle comment like', getUserId(req))
  }
}

// Get content comment likes
const getContentCommentLikes = async (req: Request, res: Response) => {
  try {
    const validatedData = getContentCommentLikesSchema.parse(req.query)
    const result = await ContentCommentsService.getCommentLikes(validatedData)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'get comment likes')
  }
}

// ============================================================================
// CONTENT LIKES OPERATIONS
// ============================================================================

// Create content like
const createContentLike = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const validatedData = createContentLikeSchema.parse(req.body)

    const result = await ContentLikesService.toggleLike(userId, validatedData)

    res.status(result.liked ? 201 : 200).json(result)
  } catch (error) {
    handleControllerError(error, res, 'toggle like', getUserId(req))
  }
}

// Delete content like (unlike)
const deleteContentLike = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const contentId = req.params.contentId
    const validatedData = createContentLikeSchema.parse({ contentId })

    const result = await ContentLikesService.toggleLike(userId, validatedData)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'unlike content', getUserId(req))
  }
}

// Get content likes
const getContentLikes = async (req: Request, res: Response) => {
  try {
    const validatedData = getContentLikesSchema.parse(req.query)
    const result = await ContentLikesService.getLikes(validatedData)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'get likes')
  }
}

// ============================================================================
// CONTENT SHARES OPERATIONS
// ============================================================================

// Create content share
const createContentShare = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const validatedData = createContentShareSchema.parse(req.body)

    const result = await ContentSharesService.toggleShare(userId, validatedData)

    res.status(result.shared ? 201 : 200).json(result)
  } catch (error) {
    handleControllerError(error, res, 'toggle share', getUserId(req))
  }
}

// Get content shares
const getContentShares = async (req: Request, res: Response) => {
  try {
    const validatedData = getContentSharesSchema.parse(req.query)
    const result = await ContentSharesService.getShares(validatedData)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'get shares')
  }
}

// ============================================================================
// CONTENT REPORTS OPERATIONS (ADMIN ONLY)
// ============================================================================

// Create content report
const createContentReport = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const validatedData = createContentReportSchema.parse(req.body)

    const report = await ContentReportsService.createReport(userId, validatedData)

    res.status(201).json({
      message: 'Report created successfully',
      report,
    })
  } catch (error) {
    handleControllerError(error, res, 'create report', getUserId(req))
  }
}

// Update content report (admin only)
const updateContentReport = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const reportId = parseInt(req.params.id)
    const validatedData = updateContentReportSchema.parse(req.body)

    const report = await ContentReportsService.updateReport(userId, reportId, validatedData)

    res.json({
      message: 'Report updated successfully',
      report,
    })
  } catch (error) {
    handleControllerError(error, res, 'update report', getUserId(req))
  }
}

// Get content reports (admin only)
const getContentReports = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const validatedData = getContentReportsSchema.parse(req.query)

    const result = await ContentReportsService.getReports(userId, validatedData)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'get reports', getUserId(req))
  }
}

export {
  createContent,
  updateContent,
  getContent,
  getContentById,
  deleteContent,
  createContentComment,
  updateContentComment,
  getContentComments,
  createContentCommentLike,
  getContentCommentLikes,
  createContentLike,
  deleteContentLike,
  getContentLikes,
  createContentShare,
  getContentShares,
  createContentReport,
  updateContentReport,
  getContentReports,
}
