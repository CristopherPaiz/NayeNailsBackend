import express from 'express'
import {
  registrarTarjeta,
  obtenerTarjetas,
  obtenerTarjetaPorCodigo,
  obtenerTarjetaPorTelefono,
  editarVisitas,
  canjearTarjeta,
  obtenerHistorialVisitas
} from '../controllers/fidelidad.controller.js'
import { authMiddleware } from '../middlewares/auth.js'

const fidelidadRoutes = express.Router()

// Rutas de Admin
fidelidadRoutes.post('/', authMiddleware, registrarTarjeta)
fidelidadRoutes.get('/', authMiddleware, obtenerTarjetas)
fidelidadRoutes.put('/:id/visitas', authMiddleware, editarVisitas)
fidelidadRoutes.post('/:id/canjear', authMiddleware, canjearTarjeta)
fidelidadRoutes.get('/:id/historial', authMiddleware, obtenerHistorialVisitas)

// Rutas Públicas
fidelidadRoutes.get('/public/buscar', obtenerTarjetaPorTelefono)
fidelidadRoutes.get('/public/:codigo', obtenerTarjetaPorCodigo)

export default fidelidadRoutes
