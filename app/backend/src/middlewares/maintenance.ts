import { Request, Response, NextFunction } from 'express'

// Maintenance mode configuration
interface MaintenanceConfig {
  enabled: boolean
  message?: string
  estimatedTime?: string
  allowedIPs?: string[]
  allowedRoutes?: string[]
}

// Global maintenance configuration
let maintenanceConfig: MaintenanceConfig = {
  enabled: false,
  message: 'System is under maintenance. Please try again later.',
  estimatedTime: 'Unknown',
  allowedIPs: [],
  allowedRoutes: ['/health', '/health/live', '/health/ready'],
}

// Update maintenance configuration
export const setMaintenanceMode = (config: Partial<MaintenanceConfig>): void => {
  maintenanceConfig = { ...maintenanceConfig, ...config }
}

// Get maintenance configuration
export const getMaintenanceMode = (): MaintenanceConfig => {
  return { ...maintenanceConfig }
}

// Maintenance mode middleware
export const maintenanceMode = (req: Request, res: Response, next: NextFunction): void => {
  // Skip if maintenance is not enabled
  if (!maintenanceConfig.enabled) {
    return next()
  }

  const clientIP = req.ip || req.connection.remoteAddress || 'unknown'
  const requestedPath = req.path

  // Allow health check endpoints
  if (maintenanceConfig.allowedRoutes?.some(route => requestedPath.startsWith(route))) {
    return next()
  }

  // Allow specific IPs (for admin access during maintenance)
  if (maintenanceConfig.allowedIPs?.includes(clientIP)) {
    return next()
  }

  // Return maintenance response
  res.status(503).json({
    error: 'Service unavailable',
    message: maintenanceConfig.message,
    maintenance: {
      estimatedCompletion: maintenanceConfig.estimatedTime,
      contactSupport: 'Please contact support for more information',
    },
    timestamp: new Date().toISOString(),
  })
}

// Enable maintenance mode helper
export const enableMaintenance = (options: Partial<MaintenanceConfig> = {}): void => {
  setMaintenanceMode({
    enabled: true,
    message: options.message || 'System is under maintenance. Please try again later.',
    estimatedTime: options.estimatedTime || 'Unknown',
    allowedIPs: options.allowedIPs || [],
    allowedRoutes: options.allowedRoutes || ['/health', '/health/live', '/health/ready'],
  })
}

// Disable maintenance mode helper
export const disableMaintenance = (): void => {
  setMaintenanceMode({ enabled: false })
}
