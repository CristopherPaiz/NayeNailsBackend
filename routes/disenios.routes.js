import express from 'express'
import {
  getAllDisenios,
  getAllDiseniosAdmin,
  createDisenio,
  updateDisenio,
  toggleActivoDisenio,
  deleteDisenio
} from '../controllers/disenios.controller.js'
import { authMiddleware } from '../middlewares/auth.js'
import { handleUpload } from '../middlewares/upload.middleware.js' // Importar middleware

const diseniosRoutes = express.Router()

// Ruta pública para explorar diseños
diseniosRoutes.get('/', getAllDisenios)

// Rutas de Admin (protegidas)
diseniosRoutes.get('/admin', authMiddleware, getAllDiseniosAdmin)
// Aplicar middleware de subida para crear y actualizar
diseniosRoutes.post(
  '/',
  authMiddleware,
  handleUpload('imagen_disenio'),
  createDisenio
)
diseniosRoutes.put(
  '/:id',
  authMiddleware,
  handleUpload('imagen_disenio'),
  updateDisenio
)
diseniosRoutes.patch('/:id/toggle-activo', authMiddleware, toggleActivoDisenio)
diseniosRoutes.delete('/:id', authMiddleware, deleteDisenio)

export default diseniosRoutes
