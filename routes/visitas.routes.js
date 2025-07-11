import express from 'express'
import { registrarEvento } from '../controllers/visitas.controller.js'

const visitasRoutes = express.Router()

visitasRoutes.post('/track', registrarEvento)

export default visitasRoutes
