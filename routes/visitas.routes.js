import express from 'express'
import { registrarVisita } from '../controllers/visitas.controller.js'

const visitasRoutes = express.Router()

visitasRoutes.post('/registrar', registrarVisita)

export default visitasRoutes
