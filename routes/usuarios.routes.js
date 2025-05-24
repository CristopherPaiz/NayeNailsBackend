import express from 'express'
import {
  updateMyNombre,
  updateMyPassword
} from '../controllers/usuarios.controller.js'
import { authMiddleware } from '../middlewares/auth.js'

const usuariosRoutes = express.Router()

usuariosRoutes.put('/me/nombre', authMiddleware, updateMyNombre)
usuariosRoutes.put('/me/password', authMiddleware, updateMyPassword)

export default usuariosRoutes
