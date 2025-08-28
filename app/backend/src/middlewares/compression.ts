import { Request, Response, NextFunction } from 'express'
import compression from 'compression'

// Use the standard compression middleware from npm
// This is much more reliable than custom implementations
export const conditionalCompression = compression({
  // Compress responses larger than 1KB
  threshold: 1024,
  // Use gzip by default, brotli if supported by client
  filter: (req: Request, res: Response) => {
    const acceptEncoding = req.headers['accept-encoding'] as string
    return acceptEncoding ? acceptEncoding.includes('gzip') || acceptEncoding.includes('br') : false
  },
})

// Simple gzip compression (fallback)
export const gzipCompression = compression({
  threshold: 1024,
  filter: (req: Request, res: Response) => {
    const acceptEncoding = req.headers['accept-encoding'] as string
    return acceptEncoding ? acceptEncoding.includes('gzip') : false
  },
})

// Brotli compression (if supported)
export const brotliCompression = compression({
  threshold: 1024,
  filter: (req: Request, res: Response) => {
    const acceptEncoding = req.headers['accept-encoding'] as string
    return acceptEncoding ? acceptEncoding.includes('br') : false
  },
})

// Custom compression middleware (simplified)
export const compressionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const acceptEncoding = req.headers['accept-encoding'] as string

  if (!acceptEncoding) {
    return next()
  }

  // Set Vary header to ensure proper caching
  res.setHeader('Vary', 'Accept-Encoding')

  // Use built-in compression if available
  if (acceptEncoding.includes('br')) {
    res.setHeader('Content-Encoding', 'br')
  } else if (acceptEncoding.includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip')
  }

  next()
}
