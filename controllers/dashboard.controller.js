import { getDb } from '../database/connection.js'

export const getEstadisticasDashboard = async (req, res) => {
  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ message: 'Base de datos no disponible.' })
    }

    const {
      rows: [conteoDisenios]
    } = await db.execute(
      'SELECT COUNT(*) as total FROM Disenios WHERE activo = 1'
    )

    const {
      rows: [conteoCitasProximas]
    } = await db.execute(
      "SELECT COUNT(*) as total FROM Citas WHERE (estado = 'pendiente' OR estado = 'confirmada') AND fecha_cita >= date('now')"
    )

    const {
      rows: [conteoVisitasMesActual]
    } = await db.execute(
      "SELECT COUNT(*) as total FROM Visitas WHERE strftime('%Y-%m', fecha_visita) = strftime('%Y-%m', 'now')"
    )

    const { rows: citasPorEstado } = await db.execute({
      sql: "SELECT estado, COUNT(*) as total FROM Citas WHERE strftime('%Y-%m-%d', fecha_cita) >= date('now', '-30 days') AND strftime('%Y-%m-%d', fecha_cita) <= date('now') GROUP BY estado ORDER BY total DESC",
      args: []
    })

    const { rows: visitasDiarias } = await db.execute({
      sql: "SELECT strftime('%Y-%m-%d', fecha_visita) as dia, COUNT(*) as total FROM Visitas WHERE strftime('%Y-%m-%d', fecha_visita) >= date('now', '-7 days') AND strftime('%Y-%m-%d', fecha_visita) <= date('now') GROUP BY dia ORDER BY dia ASC",
      args: []
    })

    const { rows: diseniosPorCategoria } = await db.execute({
      sql: `
        SELECT cp.nombre as categoria_padre, COUNT(d.id) as total_disenios
        FROM Disenios d
        JOIN DisenioSubcategorias ds ON d.id = ds.id_disenio
        JOIN Subcategorias s ON ds.id_subcategoria = s.id
        JOIN CategoriasPadre cp ON s.id_categoria_padre = cp.id
        WHERE d.activo = 1 AND s.activo = 1 AND cp.activo = 1
        GROUP BY cp.id, cp.nombre
        ORDER BY total_disenios DESC
        LIMIT 5
      `,
      args: []
    })

    const { rows: visitasMensuales } = await db.execute({
      sql: "SELECT strftime('%Y-%m', fecha_visita) as mes, COUNT(*) as total FROM Visitas WHERE fecha_visita >= date('now', '-12 months') AND fecha_visita < date('now', '+1 month') GROUP BY mes ORDER BY mes ASC",
      args: []
    })

    const { rows: citasDiariasAgendadas } = await db.execute({
      sql: "SELECT strftime('%Y-%m-%d', fecha_cita) as dia, COUNT(*) as total FROM Citas WHERE fecha_cita >= date('now', '-30 days') AND fecha_cita <= date('now') GROUP BY dia ORDER BY dia ASC",
      args: []
    })

    const { rows: serviciosMasSolicitados } = await db.execute({
      sql: `
        SELECT s.nombre as nombre_subcategoria, cp.nombre as nombre_categoria_padre, COUNT(c.id) as total_citas
        FROM Citas c
        JOIN Subcategorias s ON c.id_subcategoria_servicio = s.id
        JOIN CategoriasPadre cp ON s.id_categoria_padre = cp.id
        WHERE c.fecha_cita >= date('now', '-30 days') AND c.fecha_cita <= date('now')
        GROUP BY s.id, s.nombre, cp.nombre
        ORDER BY total_citas DESC
        LIMIT 5
      `,
      args: []
    })

    return res.status(200).json({
      totalDisenios: conteoDisenios?.total ?? 0,
      citasProximas: conteoCitasProximas?.total ?? 0,
      visitasEsteMes: conteoVisitasMesActual?.total ?? 0,
      citasPorEstado: citasPorEstado ?? [],
      visitasDiarias: visitasDiarias ?? [],
      diseniosPorCategoria: diseniosPorCategoria ?? [],
      visitasMensuales: visitasMensuales ?? [],
      citasDiariasAgendadas: citasDiariasAgendadas ?? [],
      serviciosMasSolicitados: serviciosMasSolicitados ?? []
    })
  } catch (error) {
    console.error('Error al obtener estadísticas del dashboard:', error)
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al obtener estadísticas.' })
  }
}
