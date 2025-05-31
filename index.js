import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.routes.js'
import categoriasRoutes from './routes/categorias.routes.js'
import diseniosRoutes from './routes/disenios.routes.js'
import usuariosRoutes from './routes/usuarios.routes.js'
import configuracionesRoutes from './routes/configuraciones.routes.js'
import visitasRoutes from './routes/visitas.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js'
import siteUploadsRoutes from './routes/siteUploads.routes.js'
import textosColoresRoutes from './routes/textosColores.routes.js' // NUEVA RUTA
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

app.enable('trust proxy')

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://nayenails.netlify.app',
      process.env.FRONTEND_URL
    ].filter(Boolean),
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
        throw new Error('Invalid JSON')
      }
    }
  })
)

app.use(cookieParser())

app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/')) {
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
app.use('/api/textos-colores', textosColoresRoutes) // USO DE NUEVA RUTA
app.use('/api/visitas', visitasRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/site-uploads', siteUploadsRoutes)
// app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.use((err, req, res, next) => {
  console.error('Error en la aplicación:', err.message, err.stack)
  const errorMessage =
    process.env.NODE_ENV === 'production'
      ? 'Ocurrió un error en el servidor.'
      : err.message
  res.status(err.status ?? 500).json({ message: errorMessage })
})

process.on('unhandledRejection', (razon, promesa) => {
  console.error('Unhandled Rejection at:', promesa, 'reason:', razon)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

const startServer = async () => {
  try {
    const db = await getDb()
    if (!db) {
      console.error(
        'No se pudo iniciar el servidor: Error de conexión a la base de datos al arrancar.'
      )
      process.exit(1)
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
