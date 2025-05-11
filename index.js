import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.routes.js'

const app = express()
const port = process.env.PORT || 3000

// Usar CORS
app.use(cors())

// Middleware para parsear JSON
app.use(express.json())

// Configurar cookie-parser
app.use(cookieParser())

// IMPORTAR RUTAS
app.use('/api/auth', authRoutes)

// Manejo de errores globales en Express
app.use((err, req, res, next) => {
  console.error('Error en la aplicación:', err.stack)

  res
    .status(500)
    .json({ mensaje: 'Ocurrió un error en el servidor', error: err.message })
})

// Manejo de promesas rechazadas que no fueron capturadas
process.on('unhandledRejection', (razon, promesa) => {
  console.log('Se detectó una promesa rechazada no manejada')
  console.log('Promesa:', promesa)
  console.log('Razón:', razon)
})

// Manejo de excepciones no capturadas en el proceso principal
process.on('uncaughtException', (error) => {
  console.log('Se produjo una excepción no capturada en el proceso principal')
  console.log('Error:', error)
  // process.exit(1)
})

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
