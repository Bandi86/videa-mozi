import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { Request } from 'express'

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads')
const postsDir = path.join(uploadsDir, 'posts')
const profilesDir = path.join(uploadsDir, 'profiles')
const commentsDir = path.join(uploadsDir, 'comments')

;[uploadsDir, postsDir, profilesDir, commentsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

// Storage configuration
const storage = multer.diskStorage({
  destination: (req: Request, file: MulterFile, cb) => {
    let uploadPath = uploadsDir

    if (req.originalUrl.includes('/posts')) {
      uploadPath = postsDir
    } else if (req.originalUrl.includes('/users') || req.originalUrl.includes('/profile')) {
      uploadPath = profilesDir
    } else if (req.originalUrl.includes('/comments')) {
      uploadPath = commentsDir
    }

    cb(null, uploadPath)
  },
  filename: (req: Request, file: MulterFile, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const extension = path.extname(file.originalname)
    const basename = path.basename(file.originalname, extension)
    cb(null, `${basename}-${uniqueSuffix}${extension}`)
  },
})

// File filter for images
const imageFilter = (req: Request, file: MulterFile, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)

  if (mimetype && extname) {
    return cb(null, true)
  } else {
    cb(new Error('Only image files are allowed!'))
  }
}

// Upload configurations
export const uploadPostImages = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10, // Maximum 10 files
  },
  fileFilter: imageFilter,
})

export const uploadProfilePicture = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
    files: 1,
  },
  fileFilter: imageFilter,
})

export const uploadCommentImage = multer({
  storage,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB limit
    files: 1,
  },
  fileFilter: imageFilter,
})

// Multiple post images upload
export const uploadMultiplePostImages = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 10, // Maximum 10 files
  },
  fileFilter: imageFilter,
}).array('images', 10)

// Single post image upload
export const uploadSinglePostImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
  },
  fileFilter: imageFilter,
}).single('image')

// Profile picture upload
export const uploadProfileImage = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
    files: 1,
  },
  fileFilter: imageFilter,
}).single('profilePicture')

// Comment image upload
export const uploadCommentImageSingle = multer({
  storage,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB limit
    files: 1,
  },
  fileFilter: imageFilter,
}).single('image')
