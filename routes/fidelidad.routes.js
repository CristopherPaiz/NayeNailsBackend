import express from 'express'
import {
  registrarTarjeta,
  obtenerTarjetas,
  obtenerTarjetaPorCodigo,
  obtenerTarjetaPorTelefono,
  editarVisitas,
  canjearTarjeta,
  obtenerHistorialVisitas,
  updateTarjeta,
  deleteTarjeta
} from '../controllers/fidelidad.controller.js'
import { authMiddleware } from '../middlewares/auth.js'

const fidelidadRoutes = express.Router()

fidelidadRoutes.post('/', authMiddleware, registrarTarjeta)
fidelidadRoutes.get('/', authMiddleware, obtenerTarjetas)
fidelidadRoutes.put('/:id', authMiddleware, updateTarjeta)
fidelidadRoutes.delete('/:id', authMiddleware, deleteTarjeta)
fidelidadRoutes.put('/:id/visitas', authMiddleware, editarVisitas)
fidelidadRoutes.post('/:id/canjear', authMiddleware, canjearTarjeta)
fidelidadRoutes.get('/:id/historial', authMiddleware, obtenerHistorialVisitas)

fidelidadRoutes.get('/public/buscar', obtenerTarjetaPorTelefono)
fidelidadRoutes.get('/public/:codigo', obtenerTarjetaPorCodigo)

export default fidelidadRoutes
