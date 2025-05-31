import express from 'express'
import {
  getTextosColoresConfig,
  updateTextosColoresConfig
} from '../controllers/textosColores.controller.js'
import { authMiddleware } from '../middlewares/auth.js'

const textosColoresRoutes = express.Router()

textosColoresRoutes.get('/', getTextosColoresConfig) // Pública para que el frontend la consuma
textosColoresRoutes.put('/', authMiddleware, updateTextosColoresConfig) // Protegida para admin

export default textosColoresRoutes
