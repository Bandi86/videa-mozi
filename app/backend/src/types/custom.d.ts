declare module 'morgan'
declare module 'cors'

declare global {
  namespace Express {
    interface Request {
      file?: MulterFile
      files?: MulterFile[] | { [fieldname: string]: MulterFile[] }
    }
  }
}

interface MulterFile {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  size: number
  destination: string
  filename: string
  path: string
  buffer: Buffer
}
