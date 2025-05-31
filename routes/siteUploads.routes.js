import express from 'express'
import { uploadSiteImage } from '../controllers/siteUploads.controller.js'
import { authMiddleware } from '../middlewares/auth.js'
import { handleSiteConfigUpload } from '../middlewares/upload.middleware.js'

const router = express.Router()

router.post(
  '/image',
  authMiddleware,
  handleSiteConfigUpload('site_image'),
  uploadSiteImage
)

export default router
