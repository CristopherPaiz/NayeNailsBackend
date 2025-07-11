import { getDb } from '../database/connection.js'
import { parseUserAgent } from '../utils/analyticsUtils.js'

export const registrarEvento = async (req, res) => {
  const { sessionId, path, referrer } = req.body

  if (!sessionId || !path) {
    return res
      .status(400)
      .json({ message: 'Session ID y Path son requeridos.' })
  }

  const ipAddress =
    req.ip ||
    req.headers['x-forwarded-for']?.split(',').shift()?.trim() ||
    req.socket?.remoteAddress ||
    'Desconocida'

  const userAgent = req.headers['user-agent'] || 'Desconocido'
  const { browser_name, os_name, device_type } = parseUserAgent(userAgent)

  try {
    const db = await getDb()
    if (!db) {
      return res.status(204).send()
    }

    await db.execute({
      sql: `
        INSERT INTO Visitas (
          session_id, page_path, ip_address, user_agent,
          device_type, browser_name, os_name, referrer
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        sessionId,
        path,
        ipAddress,
        userAgent,
        device_type,
        browser_name,
        os_name,
        referrer || null
      ]
    })

    return res.status(201).json({ message: 'Evento registrado.' })
  } catch (error) {
    console.error('Error al registrar evento de visita:', error)
    return res.status(204).send()
  }
}
