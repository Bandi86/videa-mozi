import { Request, Response } from 'express'
import { ReportsService } from '../services/reportsService.js'
import {
  createReportSchema,
  updateReportSchema,
  getReportsSchema,
} from '../validators/socialValidators.js'
import { getUserId, handleControllerError } from '../utils/common.js'

// Create a new report
const createReport = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const validatedData = createReportSchema.parse(req.body)

    const report = await ReportsService.createReport(userId, validatedData)

    res.status(201).json({
      message: 'Report created successfully',
      report,
    })
  } catch (error) {
    handleControllerError(error, res, 'createReport')
  }
}

// Update report
const updateReport = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const reportId = parseInt(req.params.id)
    const validatedData = updateReportSchema.parse(req.body)

    const report = await ReportsService.updateReport(userId, reportId, validatedData)

    res.json({
      message: 'Report updated successfully',
      report,
    })
  } catch (error) {
    handleControllerError(error, res, 'updateReport')
  }
}

// Delete report
const deleteReport = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const reportId = parseInt(req.params.id)

    await ReportsService.deleteReport(userId, reportId)

    res.json({
      message: 'Report deleted successfully',
    })
  } catch (error) {
    handleControllerError(error, res, 'deleteReport')
  }
}

// Get reports with pagination and filtering
const getReports = async (req: Request, res: Response) => {
  try {
    const validatedData = getReportsSchema.parse(req.query)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await ReportsService.getReports({
      ...validatedData,
      page,
      limit,
    })

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getReports')
  }
}

// Get report by ID
const getReportById = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id)

    const report = await ReportsService.getReportById(reportId)

    res.json({ report })
  } catch (error) {
    handleControllerError(error, res, 'getReportById')
  }
}

// Get reports by post
const getReportsByPost = async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.postId)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await ReportsService.getReportsByPost(postId, page, limit)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getReportsByPost')
  }
}

// Get reports by user
const getReportsByUser = async (req: Request, res: Response) => {
  try {
    const reportedUserId = parseInt(req.params.userId)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const result = await ReportsService.getReportsByUser(reportedUserId, page, limit)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'getReportsByUser')
  }
}

// Get report statistics
const getReportStats = async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined

    const stats = await ReportsService.getReportStats(userId)

    res.json({ stats })
  } catch (error) {
    handleControllerError(error, res, 'getReportStats')
  }
}

export {
  createReport,
  updateReport,
  deleteReport,
  getReports,
  getReportById,
  getReportsByPost,
  getReportsByUser,
  getReportStats,
}
