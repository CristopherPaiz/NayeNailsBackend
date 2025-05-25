import express from 'express'
import { getEstadisticasDashboard } from '../controllers/dashboard.controller.js'
import { authMiddleware } from '../middlewares/auth.js'
import { registrarVisita } from '../controllers/visitas.controller.js'
const dashboardRoutes = express.Router()

dashboardRoutes.post('/visitas', registrarVisita)

dashboardRoutes.get('/estadisticas', authMiddleware, getEstadisticasDashboard)

export default dashboardRoutes
