import { getDb } from '../database/connection.js'

export const getSessionDetails = async (req, res) => {
  const { sessionId } = req.params
  if (!sessionId) {
    return res.status(400).json({ message: 'Session ID es requerido.' })
  }

  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ message: 'Base de datos no disponible.' })
    }

    const { rows } = await db.execute({
      sql: `
        SELECT
          page_path,
          COUNT(*) as views,
          MIN(event_timestamp) as first_visit_to_page
        FROM Visitas
        WHERE session_id = ?
        GROUP BY page_path
        ORDER BY first_visit_to_page ASC
      `,
      args: [sessionId]
    })

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: 'No se encontraron detalles para esta sesión.' })
    }

    return res.status(200).json(rows)
  } catch (error) {
    console.error('Error al obtener detalles de la sesión:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const trackTime = async (req, res) => {
  const { sessionId, path, duration } = req.body

  if (!sessionId || !path || duration === undefined) {
    return res
      .status(400)
      .json({ message: 'sessionId, path, y duration son requeridos.' })
  }

  try {
    const db = await getDb()
    if (!db) {
      return res.status(204).send()
    }

    await db.execute({
      sql: 'INSERT INTO PageTimings (session_id, page_path, duration_seconds) VALUES (?, ?, ?)',
      args: [sessionId, path, Math.round(duration)]
    })

    res.status(204).send()
  } catch (error) {
    console.error('Error al registrar tiempo en página:', error)
    res.status(204).send()
  }
}
