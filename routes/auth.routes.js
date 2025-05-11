import express from 'express'
import { login, register, logout } from '../controllers/auth.controller.js'
import { authMiddleware } from '../middlewares/auth.js'

const authRoutes = express.Router()

// Ruta para el registro de un nuevo usuario
authRoutes.post('/register', register)
// Ruta para el inicio de sesión
authRoutes.post('/login', login)
// Ruta para el cierre de sesión
authRoutes.post('/logout', logout)

// Ruta protegida de ejemplo
authRoutes.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user })
})

export default authRoutes
