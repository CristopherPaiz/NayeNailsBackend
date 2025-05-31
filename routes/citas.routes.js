import express from 'express'
import {
  crearCita,
  obtenerCitasAdmin,
  actualizarEstadoCita
} from '../controllers/citas.controller.js'
import { authMiddleware } from '../middlewares/auth.js'

const citasRoutes = express.Router()

// Ruta pública para que los clientes creen citas
citasRoutes.post('/', crearCita)

// Rutas protegidas para el administrador
citasRoutes.get('/admin', authMiddleware, obtenerCitasAdmin)
citasRoutes.patch('/admin/:id/estado', authMiddleware, actualizarEstadoCita) // PATCH para actualizaciones parciales

export default citasRoutes
