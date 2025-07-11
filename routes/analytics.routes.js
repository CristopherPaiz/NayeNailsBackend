import express from 'express'
import {
  getSessionDetails,
  trackTime
} from '../controllers/analytics.controller.js'
import { authMiddleware } from '../middlewares/auth.js'

const router = express.Router()

router.get('/session/:sessionId', authMiddleware, getSessionDetails)
router.post('/track-time', trackTime)

export default router
