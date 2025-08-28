import { Request, Response } from 'express'
import prisma from '../config/prisma.js'
import {
  createTagSchema,
  updateTagSchema,
  CreateTagInput,
  UpdateTagInput,
} from '../validators/socialValidators.js'
import { logBusinessEvent, logSecurityEvent } from '../config/logger.js'

// Create a new tag
const createTag = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Check admin privileges
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { roles: true },
    })

    if (!user || user.roles !== 'ADMIN') {
      return res.status(403).json({ error: 'Insufficient privileges to create tags' })
    }

    const validatedData = createTagSchema.parse(req.body)
    const { name } = validatedData

    const tag = await prisma.tags.create({
      data: {
        name,
      },
    })

    logBusinessEvent('TAG_CREATED', { tagId: tag.id, createdBy: userId })

    res.status(201).json({
      message: 'Tag created successfully',
      tag,
    })
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Tag name already exists' })
    }
    logSecurityEvent('TAG_CREATION_FAILED', { error: error.message, userId: (req as any).user?.id })
    res.status(500).json({ error: 'Failed to create tag' })
  }
}

// Update a tag
const updateTag = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    const tagId = parseInt(req.params.id)

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Check admin privileges
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { roles: true },
    })

    if (!user || user.roles !== 'ADMIN') {
      return res.status(403).json({ error: 'Insufficient privileges to update tags' })
    }

    const validatedData = updateTagSchema.parse(req.body)

    // Check if tag exists
    const existingTag = await prisma.tags.findUnique({
      where: { id: tagId },
    })

    if (!existingTag) {
      return res.status(404).json({ error: 'Tag not found' })
    }

    const tag = await prisma.tags.update({
      where: { id: tagId },
      data: validatedData,
    })

    logBusinessEvent('TAG_UPDATED', { tagId, updatedBy: userId })

    res.json({
      message: 'Tag updated successfully',
      tag,
    })
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Tag name already exists' })
    }
    logSecurityEvent('TAG_UPDATE_FAILED', { error: error.message, userId: (req as any).user?.id })
    res.status(500).json({ error: 'Failed to update tag' })
  }
}

// Delete a tag
const deleteTag = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    const tagId = parseInt(req.params.id)

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Check admin privileges
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { roles: true },
    })

    if (!user || user.roles !== 'ADMIN') {
      return res.status(403).json({ error: 'Insufficient privileges to delete tags' })
    }

    // Check if tag exists
    const existingTag = await prisma.tags.findUnique({
      where: { id: tagId },
    })

    if (!existingTag) {
      return res.status(404).json({ error: 'Tag not found' })
    }

    await prisma.tags.delete({
      where: { id: tagId },
    })

    logBusinessEvent('TAG_DELETED', { tagId, deletedBy: userId })

    res.json({ message: 'Tag deleted successfully' })
  } catch (error) {
    logSecurityEvent('TAG_DELETION_FAILED', { error: error.message, userId: (req as any).user?.id })
    res.status(500).json({ error: 'Failed to delete tag' })
  }
}

// Get all tags
const getTags = async (req: Request, res: Response) => {
  try {
    const tags = await prisma.tags.findMany({
      include: {
        _count: {
          select: {
            posts: true,
            comments: true,
            likes: true,
            shares: true,
            reports: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    res.json({ tags })
  } catch (error) {
    logSecurityEvent('GET_TAGS_FAILED', { error: error.message })
    res.status(500).json({ error: 'Failed to fetch tags' })
  }
}

// Get a single tag by ID
const getTagById = async (req: Request, res: Response) => {
  try {
    const tagId = parseInt(req.params.id)

    const tag = await prisma.tags.findUnique({
      where: { id: tagId },
      include: {
        _count: {
          select: {
            posts: true,
            comments: true,
            likes: true,
            shares: true,
            reports: true,
          },
        },
      },
    })

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' })
    }

    res.json({ tag })
  } catch (error) {
    logSecurityEvent('GET_TAG_FAILED', { error: error.message })
    res.status(500).json({ error: 'Failed to fetch tag' })
  }
}

export { createTag, updateTag, deleteTag, getTags, getTagById }
