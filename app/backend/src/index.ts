import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'

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

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
})
