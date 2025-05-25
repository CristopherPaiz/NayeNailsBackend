import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.routes.js'
import categoriasRoutes from './routes/categorias.routes.js'
import diseniosRoutes from './routes/disenios.routes.js'
import usuariosRoutes from './routes/usuarios.routes.js'
import configuracionesRoutes from './routes/configuraciones.routes.js'
import visitasRoutes from './routes/visitas.routes.js' // NUEVA RUTA
import dashboardRoutes from './routes/dashboard.routes.js' // NUEVA RUTA
// adminRoutes no se usa directamente si las funcionalidades de admin están en sus propios módulos (usuarios, disenios, etc.)
// import adminRoutes from './routes/admin.routes.js';
import dotenv from 'dotenv'
import { getDb } from './database/connection.js'
dotenv.config()

const app = express()
const port = process.env.PORT ?? 3000

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

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://nayenails.netlify.app',
      process.env.FRONTEND_URL
    ].filter(Boolean), // Añadir variable de entorno para frontend
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
)

app.use(
  express.json({
    verify: (req, res, buf, encoding) => {
      try {
        JSON.parse(buf)
      } catch (e) {
        res.status(400).send('Invalid JSON')
        throw new Error('Invalid JSON') // Esto detendrá el procesamiento si el JSON es inválido
      }
    }
  })
)

app.use(cookieParser())

// Middleware para verificar conexión a BD en rutas API
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    // Solo para rutas API
    try {
      const db = await getDb()
      if (!db) {
        return res.status(503).json({
          message:
            'Base de datos no disponible temporalmente. Intente más tarde.'
        })
      }
    } catch (dbError) {
      console.error('Error crítico al obtener la instancia de BD:', dbError)
      return res.status(503).json({
        message: 'Error crítico con la base de datos. Intente más tarde.'
      })
    }
  }
  next()
})

app.use('/api/auth', authRoutes)
app.use('/api/categorias', categoriasRoutes)
app.use('/api/disenios', diseniosRoutes)
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/configuraciones-sitio', configuracionesRoutes)
app.use('/api/visitas', visitasRoutes) // NUEVA RUTA
app.use('/api/dashboard', dashboardRoutes) // NUEVA RUTA
// app.use('/api/admin', adminRoutes); // Comentado si no se usa directamente

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error en la aplicación:', err.message, err.stack)
  // Evitar enviar el stack trace en producción
  const errorMessage =
    process.env.NODE_ENV === 'production'
      ? 'Ocurrió un error en el servidor.'
      : err.message
  res
    .status(err.status ?? 500) // Usar err.status si está disponible
    .json({ message: errorMessage })
})

process.on('unhandledRejection', (razon, promesa) => {
  console.error('Unhandled Rejection at:', promesa, 'reason:', razon)
  // Considerar terminar el proceso en producción para evitar estados inconsistentes
  // if (process.env.NODE_ENV === 'production') process.exit(1);
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  // Es crítico terminar el proceso aquí, ya que el estado de la aplicación es desconocido
  process.exit(1)
})

const startServer = async () => {
  try {
    const db = await getDb() // Asegurar que la conexión inicial funcione
    if (!db) {
      console.error(
        'No se pudo iniciar el servidor: Error de conexión a la base de datos al arrancar.'
      )
      process.exit(1) // Salir si la BD no está disponible al inicio
    }

    app.listen(port, () => {
      console.log(`Servidor corriendo en http://localhost:${port}`)
    })
  } catch (err) {
    console.error('Error fatal al iniciar el servidor:', err)
    process.exit(1)
  }
}

startServer()
