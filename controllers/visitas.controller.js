import { getDb } from '../database/connection.js'

export const registrarVisita = async (req, res) => {
  const ipAddress =
    req.ip ||
    req.headers['x-forwarded-for']?.split(',').shift() ||
    req.socket?.remoteAddress
  const userAgent = req.headers['user-agent']

  try {
    const db = await getDb()
    if (!db) {
      console.warn('Registro de visita: BD no disponible.')
      return res.status(204).send()
    }

    await db.execute({
      sql: 'INSERT INTO Visitas (ip_address, user_agent) VALUES (?, ?)',
      args: [ipAddress ?? 'Desconocida', userAgent ?? 'Desconocido']
    })

    return res.status(204).send()
  } catch (error) {
    console.error('Error al registrar visita:', error)
    return res.status(204).send()
  }
}
