import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.routes.js'
import dotenv from 'dotenv'
import { getDb } from './database/connection.js'
dotenv.config()

const app = express()
const port = process.env.PORT || 3000

// Primero verificar las variables de entorno críticas
const requiredEnvVars = [
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'JWT_SECRET_KEY'
]
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])

if (missingVars.length > 0) {
  console.error(
    `ERROR: Variables de entorno faltantes: ${missingVars.join(', ')}`
  )
  process.exit(1)
}

// Usar CORS
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true
  })
)

// Middleware para parsear JSON con manejo de errores
app.use(
  express.json({
    verify: (req, res, buf, encoding) => {
      try {
        JSON.parse(buf)
      } catch (e) {
        res.status(400).send('Invalid JSON')
        throw new Error('Invalid JSON')
      }
    }
  })
)

// Configurar cookie-parser
app.use(cookieParser())

// Middleware para verificar conexión a la BD antes de procesar rutas
app.use(async (req, res, next) => {
  try {
    // Solo verificar para rutas que probablemente usen la BD
    if (req.path.startsWith('/api/')) {
      const db = await getDb()
      if (!db) {
        return res.status(503).json({ message: 'Base de datos no disponible' })
      }
    }
    next()
  } catch (err) {
    next(err)
  }
})

// IMPORTAR RUTAS
app.use('/api/auth', authRoutes)

// Ruta de prueba para verificar si el servidor está vivo
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

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
  // No terminar el proceso, solo registrar
})

// Manejo de excepciones no capturadas en el proceso principal
process.on('uncaughtException', (error) => {
  console.log('Se produjo una excepción no capturada en el proceso principal')
  console.log('Error:', error)

  // Si estamos en producción, terminar el proceso para que el gestor de procesos lo reinicie limpiamente
  if (process.env.NODE_ENV === 'production') {
    console.log('Terminando proceso debido a un error crítico...')
    process.exit(1)
  }
})

// Iniciar el servidor solo después de verificar la conexión a la BD
const startServer = async () => {
  try {
    // Verificar la conexión a la BD
    const db = await getDb()
    if (!db) {
      console.error(
        'No se pudo iniciar el servidor: Error de conexión a la base de datos'
      )
      return
    }

    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`)
    })
  } catch (err) {
    console.error('Error al iniciar el servidor:', err)
  }
}

startServer()
