import express from 'express'

import { deleteUser } from '../controllers/admin.js'

const router = express.Router()

// Rutas para la gestión de usuarios
router.get('/users', getAllUsers)
router.get('/users/:id', getUserById)
