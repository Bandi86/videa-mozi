import { Request, Response } from 'express'
import {
  createPostSchema,
  updatePostSchema,
  getPostsSchema,
} from '../validators/socialValidators.js'
import { PostsService } from '../services/postsService.js'
import { getUserId, handleControllerError } from '../utils/common.js'

// ============================================================================
// POST CRUD OPERATIONS
// ============================================================================

// Create a new post
const createPost = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const validatedData = createPostSchema.parse(req.body)

    const post = await PostsService.createPost(userId, validatedData)

    res.status(201).json({
      message: 'Post created successfully',
      post,
    })
  } catch (error) {
    handleControllerError(error, res, 'create post', getUserId(req))
  }
}

// Update a post
const updatePost = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const postId = parseInt(req.params.id)
    const validatedData = updatePostSchema.parse(req.body)

    const post = await PostsService.updatePost(userId, postId, validatedData)

    res.json({
      message: 'Post updated successfully',
      post,
    })
  } catch (error) {
    handleControllerError(error, res, 'update post', getUserId(req))
  }
}

// Delete a post
const deletePost = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const postId = parseInt(req.params.id)

    const result = await PostsService.deletePost(userId, postId)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'delete post', getUserId(req))
  }
}

// ============================================================================
// POST READ OPERATIONS
// ============================================================================

// Get all posts with filtering and pagination
const getPosts = async (req: Request, res: Response) => {
  try {
    const validatedData = getPostsSchema.parse(req.query)
    const result = await PostsService.getPosts(validatedData)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'get posts')
  }
}

// Get a single post by ID
const getPostById = async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.id)
    const post = await PostsService.getPostById(postId)

    res.json({ post })
  } catch (error) {
    handleControllerError(error, res, 'get post by ID')
  }
}

// Get posts by user
const getPostsByUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId)
    const validatedData = getPostsSchema.parse(req.query)

    const result = await PostsService.getPostsByUser(userId, validatedData)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'get posts by user')
  }
}

// ============================================================================
// POST ADDITIONAL OPERATIONS
// ============================================================================

// Get user's post statistics
const getUserPostStats = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const stats = await PostsService.getUserPostStats(userId)

    res.json({ stats })
  } catch (error) {
    handleControllerError(error, res, 'get user post stats', getUserId(req))
  }
}

// Get trending posts
const getTrendingPosts = async (req: Request, res: Response) => {
  try {
    const posts = await PostsService.getTrendingPosts()

    res.json({ posts })
  } catch (error) {
    handleControllerError(error, res, 'get trending posts')
  }
}

// Get recent posts
const getRecentPosts = async (req: Request, res: Response) => {
  try {
    const posts = await PostsService.getRecentPosts()

    res.json({ posts })
  } catch (error) {
    handleControllerError(error, res, 'get recent posts')
  }
}

export {
  createPost,
  updatePost,
  deletePost,
  getPosts,
  getPostById,
  getPostsByUser,
  getUserPostStats,
  getTrendingPosts,
  getRecentPosts,
}
