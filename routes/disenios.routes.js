import express from 'express'
import {
  getAllDisenios,
  getAllDiseniosAdmin,
  createDisenio,
  updateDisenio,
  toggleActivoDisenio
} from '../controllers/disenios.controller.js'
import { authMiddleware } from '../middlewares/auth.js'

const diseniosRoutes = express.Router()

// Ruta pública para explorar diseños
diseniosRoutes.get('/', getAllDisenios)

// Rutas de Admin (protegidas)
diseniosRoutes.get('/admin', authMiddleware, getAllDiseniosAdmin) // Para la tabla de admin
diseniosRoutes.post('/', authMiddleware, createDisenio)
diseniosRoutes.put('/:id', authMiddleware, updateDisenio)
diseniosRoutes.patch('/:id/toggle-activo', authMiddleware, toggleActivoDisenio)

export default diseniosRoutes
