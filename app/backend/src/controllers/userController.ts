import prisma from '../config/prisma.js'
import { Request, Response } from 'express'
import bcrypt from 'bcrypt'

// Get all users
const getAllUsers = async () => {
  const users = await prisma.users.findMany()
  console.log(users)
  return users
}

// Create user
const createUser = async (req: Request, res: Response) => {
  const { username, email, password } = req.body

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const users = await prisma.users.create({
    data: {
      username,
      email,
      password: hashedPassword,
    },
  })
  res.json(users)
  console.log(users)
}

export { getAllUsers, createUser }
