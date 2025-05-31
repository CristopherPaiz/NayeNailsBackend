import express from 'express'
import { uploadSiteImage } from '../controllers/siteUploads.controller.js'
import { authMiddleware } from '../middlewares/auth.js'
import {
  handleSiteConfigUpload,
  handleLocationImageUpload
} from '../middlewares/upload.middleware.js'

const router = express.Router()

router.post(
  '/image',
  authMiddleware,
  handleSiteConfigUpload('site_image'), // Para imágenes de carruseles, galería (ConfiguracionesSitio)
  uploadSiteImage
)

router.post(
  '/location-image', // Nueva ruta para la imagen de ubicación
  authMiddleware,
  handleLocationImageUpload('location_image'), // Usa el nuevo handler
  uploadSiteImage // Reutiliza el controlador, ya que solo devuelve la info de la imagen subida
)

export default router
