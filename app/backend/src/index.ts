import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import usersRoutes from './routes/users.js'

dotenv.config({
  debug: process.env.DEBUG === 'true',
})

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())
app.use(cors())
app.use(helmet())
app.use(morgan('dev'))

app.get('/', (req, res) => {
  res.send('Hello from backend!')
})

// Routes
app.use('/api/v1/users', usersRoutes)

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
})
