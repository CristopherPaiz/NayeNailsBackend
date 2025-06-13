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
import { handleUpload } from '../middlewares/upload.middleware.js'

const diseniosRoutes = express.Router()

diseniosRoutes.get('/', getAllDisenios)

diseniosRoutes.get('/admin', authMiddleware, getAllDiseniosAdmin)
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
