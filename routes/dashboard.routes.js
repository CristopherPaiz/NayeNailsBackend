import express from 'express'
import { getEstadisticasDashboard } from '../controllers/dashboard.controller.js'
import { authMiddleware } from '../middlewares/auth.js'
import { registrarEvento } from '../controllers/visitas.controller.js'
const dashboardRoutes = express.Router()

dashboardRoutes.post('/visitas', registrarEvento)

dashboardRoutes.get('/estadisticas', authMiddleware, getEstadisticasDashboard)

export default dashboardRoutes
