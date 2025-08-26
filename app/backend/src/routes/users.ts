import express from 'express'
import { getAllUsers, createUser } from '../controllers/userController.js'

const router = express.Router()

// Get all users
router.get('/', getAllUsers)

// Create a new user
router.post('/', createUser)

export default router
