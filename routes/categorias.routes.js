import express from 'express'
import {
  getAllCategorias,
  createCategoriaPadre,
  updateCategoriaPadre,
  toggleActivoCategoriaPadre,
  createSubcategoria,
  updateSubcategoria,
  toggleActivoSubcategoria
} from '../controllers/categorias.controller.js'
import { authMiddleware } from '../middlewares/auth.js'

const categoriasRoutes = express.Router()

// Rutas para Categorías Padre
categoriasRoutes.get('/', getAllCategorias) // Puede ser pública o protegida según necesidad, la dejo pública por ahora para exploración.
categoriasRoutes.post('/', authMiddleware, createCategoriaPadre)
categoriasRoutes.put('/:id', authMiddleware, updateCategoriaPadre)
categoriasRoutes.patch(
  '/:id/toggle-activo',
  authMiddleware,
  toggleActivoCategoriaPadre
)

// Rutas para Subcategorías
categoriasRoutes.post(
  '/:idPadre/subcategorias',
  authMiddleware,
  createSubcategoria
)
categoriasRoutes.put('/subcategorias/:id', authMiddleware, updateSubcategoria)
categoriasRoutes.patch(
  '/subcategorias/:id/toggle-activo',
  authMiddleware,
  toggleActivoSubcategoria
)

export default categoriasRoutes
