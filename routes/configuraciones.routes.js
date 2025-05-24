import express from 'express'
import {
  getAllConfiguraciones,
  updateConfiguracion
} from '../controllers/configuraciones.controller.js'
import { authMiddleware } from '../middlewares/auth.js'

const configuracionesRoutes = express.Router()

// Rutas protegidas para admin
configuracionesRoutes.get('/', authMiddleware, getAllConfiguraciones)
configuracionesRoutes.post('/', authMiddleware, updateConfiguracion) // Usar POST para crear/actualizar

export default configuracionesRoutes
