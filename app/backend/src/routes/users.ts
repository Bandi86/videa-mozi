import express from 'express'
import { getAllUsers } from '../controllers/userController.js'

const router = express.Router()

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await getAllUsers()
    res.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
