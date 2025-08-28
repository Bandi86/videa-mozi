import { Request, Response } from 'express'
import { UsersService } from '../services/usersService.js'
import { getUserId, handleControllerError } from '../utils/common.js'

// ============================================================================
// USER ADMIN OPERATIONS (ADMIN ONLY)
// ============================================================================

// Get all users with pagination and filtering
const getAllUsers = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const filters = req.query

    const result = await UsersService.getAllUsers(userId, filters)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'get all users', getUserId(req))
  }
}

// Get user statistics (admin only)
const getUsersStats = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const stats = await UsersService.getUsersStats(userId)

    res.json({ stats })
  } catch (error) {
    handleControllerError(error, res, 'get users stats', getUserId(req))
  }
}

// Change user role (admin only)
const changeUserRole = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const targetUserId = parseInt(req.params.userId)
    const { role } = req.body

    const user = await UsersService.changeUserRole(targetUserId, userId, role)

    res.json({
      message: 'User role updated successfully',
      user,
    })
  } catch (error) {
    handleControllerError(error, res, 'change user role', getUserId(req))
  }
}

// Delete user (admin only)
const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const targetUserId = parseInt(req.params.userId)

    const result = await UsersService.deleteUser(targetUserId, userId)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'delete user', getUserId(req))
  }
}

// ============================================================================
// USER PROFILE OPERATIONS
// ============================================================================

// Get user profile by ID
const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId)
    const currentUserId = getUserId(req)

    const user = await UsersService.getUserById(userId, currentUserId)

    res.json({ user })
  } catch (error) {
    handleControllerError(error, res, 'get user by ID', getUserId(req))
  }
}

// Get user profile (public information)
const getUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId)
    const user = await UsersService.getUserProfile(userId)

    res.json({ user })
  } catch (error) {
    handleControllerError(error, res, 'get user profile')
  }
}

// Get current user profile
const getCurrentUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const user = await UsersService.getUserById(userId, userId)

    res.json({ user })
  } catch (error) {
    handleControllerError(error, res, 'get current user profile', getUserId(req))
  }
}

// Update user profile
const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const updates = req.body

    const user = await UsersService.updateUserProfile(userId, userId, updates)

    res.json({
      message: 'Profile updated successfully',
      user,
    })
  } catch (error) {
    handleControllerError(error, res, 'update user profile', getUserId(req))
  }
}

// ============================================================================
// USER ADDITIONAL OPERATIONS
// ============================================================================

// Search users
const searchUsers = async (req: Request, res: Response) => {
  try {
    const currentUserId = getUserId(req)
    const { q: query, limit = 10 } = req.query

    const users = await UsersService.searchUsers(
      query as string,
      currentUserId,
      parseInt(limit as string),
    )

    res.json({ users })
  } catch (error) {
    handleControllerError(error, res, 'search users', getUserId(req))
  }
}

// Get user activity summary
const getUserActivity = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId)
    const activity = await UsersService.getUserActivity(userId)

    res.json({ activity })
  } catch (error) {
    handleControllerError(error, res, 'get user activity')
  }
}

export {
  getAllUsers,
  getUsersStats,
  changeUserRole,
  deleteUser,
  getUserById,
  getUserProfile,
  getCurrentUserProfile,
  updateUserProfile,
  searchUsers,
  getUserActivity,
}
