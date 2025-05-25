import { getDb } from '../database/connection.js'

export const getEstadisticasDashboard = async (req, res) => {
  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ message: 'Base de datos no disponible.' })
    }

    const {
      rows: [conteoDisenios]
    } = await db.execute('SELECT COUNT(*) as total FROM Disenios')

    const {
      rows: [conteoCitasProximas]
    } = await db.execute(
      "SELECT COUNT(*) as total FROM Citas WHERE (estado = 'pendiente' OR estado = 'confirmada') AND fecha_cita >= date('now')"
    )

    const {
      rows: [conteoVisitasMes]
    } = await db.execute(
      "SELECT COUNT(*) as total FROM Visitas WHERE strftime('%Y-%m', fecha_visita) = strftime('%Y-%m', 'now')"
    )

    return res.status(200).json({
      totalDisenios: conteoDisenios?.total ?? 0,
      citasProximas: conteoCitasProximas?.total ?? 0,
      visitasEsteMes: conteoVisitasMes?.total ?? 0
    })
  } catch (error) {
    console.error('Error al obtener estadísticas del dashboard:', error)
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al obtener estadísticas.' })
  }
}
