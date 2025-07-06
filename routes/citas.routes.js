import express from 'express'
import {
  crearCita,
  obtenerCitasAdmin,
  updateCita,
  deleteCita,
  crearCitaAdmin
} from '../controllers/citas.controller.js'
import { authMiddleware } from '../middlewares/auth.js'

const citasRoutes = express.Router()

// Ruta pública para que los clientes creen citas
citasRoutes.post('/', crearCita)

// Rutas protegidas para el administrador
citasRoutes.get('/admin', authMiddleware, obtenerCitasAdmin)
citasRoutes.post('/admin', authMiddleware, crearCitaAdmin)
citasRoutes.patch('/admin/:id', authMiddleware, updateCita)
citasRoutes.delete('/admin/:id', authMiddleware, deleteCita) // Ruta para eliminar

export default citasRoutes
