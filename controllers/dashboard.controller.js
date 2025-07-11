import { getDb } from '../database/connection.js'

export const getEstadisticasDashboard = async (req, res) => {
  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ message: 'Base de datos no disponible.' })
    }

    const [
      conteoDiseniosRes,
      conteoCitasProximasRes,
      visitantesUnicosMesRes,
      totalPageViewsMesRes,
      avgSessionDurationRes,
      bounceRateRes,
      topPaginasRes,
      visitantesPorDispositivoRes,
      visitantesDiariosRes,
      topReferrersRes,
      topSessionsTodayRes,
      citasPorEstadoRes,
      citasDiariasAgendadasRes,
      serviciosMasSolicitadosRes,
      diseniosPorCategoriaRes
    ] = await Promise.all([
      db.execute('SELECT COUNT(*) as total FROM Disenios WHERE activo = 1'),
      db.execute(
        "SELECT COUNT(*) as total FROM Citas WHERE (estado = 'pendiente' OR estado = 'confirmada') AND fecha_cita >= date('now')"
      ),
      db.execute(
        "SELECT COUNT(DISTINCT session_id) as total FROM Visitas WHERE strftime('%Y-%m', event_timestamp) = strftime('%Y-%m', 'now')"
      ),
      db.execute(
        "SELECT COUNT(id) as total FROM Visitas WHERE strftime('%Y-%m', event_timestamp) = strftime('%Y-%m', 'now')"
      ),
      db.execute(`
        SELECT AVG(session_duration) as avg_duration_seconds
        FROM (
            SELECT
                CAST(strftime('%s', MAX(event_timestamp)) - strftime('%s', MIN(event_timestamp)) AS REAL) as session_duration
            FROM Visitas
            WHERE strftime('%Y-%m', event_timestamp) = strftime('%Y-%m', 'now')
            GROUP BY session_id
        )
        WHERE session_duration > 0
      `),
      db.execute(`
        WITH SessionCounts AS (
            SELECT session_id, COUNT(id) as view_count
            FROM Visitas
            WHERE strftime('%Y-%m', event_timestamp) = strftime('%Y-%m', 'now')
            GROUP BY session_id
        ),
        BouncedSessions AS (
            SELECT COUNT(*) as bounced_count FROM SessionCounts WHERE view_count = 1
        ),
        TotalSessions AS (
            SELECT COUNT(*) as total_count FROM SessionCounts
        )
        SELECT
            CASE
                WHEN TotalSessions.total_count > 0 THEN CAST(BouncedSessions.bounced_count AS REAL) * 100 / TotalSessions.total_count
                ELSE 0
            END as bounce_rate
        FROM BouncedSessions, TotalSessions
      `),
      db.execute({
        sql: `
          SELECT page_path, COUNT(id) as views
          FROM Visitas
          WHERE strftime('%Y-%m', event_timestamp) = strftime('%Y-%m', 'now')
          GROUP BY page_path
          ORDER BY views DESC
          LIMIT 5
        `
      }),
      db.execute({
        sql: `
          SELECT device_type, COUNT(DISTINCT session_id) as total
          FROM Visitas
          WHERE strftime('%Y-%m', event_timestamp) = strftime('%Y-%m', 'now')
          GROUP BY device_type
          ORDER BY total DESC
        `
      }),
      db.execute({
        sql: `
          SELECT
            strftime('%Y-%m-%d', event_timestamp) as dia,
            COUNT(DISTINCT session_id) as total_visitantes,
            COUNT(id) as total_vistas
          FROM Visitas
          WHERE date(event_timestamp) >= date('now', '-6 days')
          GROUP BY dia
          ORDER BY dia ASC
        `
      }),
      db.execute({
        sql: `
          SELECT referrer, COUNT(id) as views
          FROM Visitas
          WHERE referrer IS NOT NULL AND referrer != ''
            AND strftime('%Y-%m', event_timestamp) = strftime('%Y-%m', 'now')
          GROUP BY referrer
          ORDER BY views DESC
          LIMIT 5
        `
      }),
      db.execute({
        sql: `
          SELECT
            session_id,
            ip_address,
            device_type,
            browser_name,
            os_name,
            COUNT(id) as views,
            MIN(event_timestamp) as first_visit,
            MAX(event_timestamp) as last_visit
          FROM Visitas
          WHERE date(event_timestamp) = date('now')
          GROUP BY session_id, ip_address, device_type, browser_name, os_name
          ORDER BY views DESC
          LIMIT 10
        `
      }),
      db.execute({
        sql: "SELECT estado, COUNT(*) as total FROM Citas WHERE strftime('%Y-%m-%d', fecha_cita) >= date('now', '-30 days') AND strftime('%Y-%m-%d', fecha_cita) <= date('now') GROUP BY estado ORDER BY total DESC"
      }),
      db.execute({
        sql: "SELECT strftime('%Y-%m-%d', fecha_cita) as dia, COUNT(*) as total FROM Citas WHERE fecha_cita >= date('now', '-30 days') AND fecha_cita <= date('now') GROUP BY dia ORDER BY dia ASC"
      }),
      db.execute({
        sql: `
          SELECT s.nombre as nombre_subcategoria, cp.nombre as nombre_categoria_padre, COUNT(c.id) as total_citas
          FROM Citas c
          JOIN CitaServicios cs ON c.id = cs.id_cita
          JOIN Subcategorias s ON cs.id_subcategoria = s.id
          JOIN CategoriasPadre cp ON s.id_categoria_padre = cp.id
          WHERE c.fecha_cita >= date('now', '-30 days') AND c.fecha_cita <= date('now')
          GROUP BY s.id, s.nombre, cp.nombre
          ORDER BY total_citas DESC
          LIMIT 5
        `
      }),
      db.execute({
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
        `
      })
    ])

    return res.status(200).json({
      totalDisenios: conteoDiseniosRes.rows[0]?.total ?? 0,
      citasProximas: conteoCitasProximasRes.rows[0]?.total ?? 0,
      visitantesUnicosMes: visitantesUnicosMesRes.rows[0]?.total ?? 0,
      totalPageViewsMes: totalPageViewsMesRes.rows[0]?.total ?? 0,
      avgSessionDuration:
        avgSessionDurationRes.rows[0]?.avg_duration_seconds ?? 0,
      bounceRate: bounceRateRes.rows[0]?.bounce_rate ?? 0,
      topPaginas: topPaginasRes.rows ?? [],
      visitantesPorDispositivo: visitantesPorDispositivoRes.rows ?? [],
      visitantesDiarios: visitantesDiariosRes.rows ?? [],
      topReferrers: topReferrersRes.rows ?? [],
      topSessionsToday: topSessionsTodayRes.rows ?? [],
      citasPorEstado: citasPorEstadoRes.rows ?? [],
      citasDiariasAgendadas: citasDiariasAgendadasRes.rows ?? [],
      serviciosMasSolicitados: serviciosMasSolicitadosRes.rows ?? [],
      diseniosPorCategoria: diseniosPorCategoriaRes.rows ?? []
    })
  } catch (error) {
    console.error('Error al obtener estadísticas del dashboard:', error)
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al obtener estadísticas.' })
  }
}
