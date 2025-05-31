import { getDb } from '../database/connection.js'

export const getTextosColoresConfig = async (req, res) => {
  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ message: 'Base de datos no disponible.' })
    }

    const { rows } = await db.execute({
      sql: 'SELECT * FROM TextosColoresConfiguraciones WHERE id = ?',
      args: [1]
    })

    if (rows.length === 0) {
      return res.status(200).json({
        id: 1,
        nombre_negocio: 'Naye Nails',
        slogan_negocio: 'Donde la perfeccion es el estándar',
        logo_negocio_url: '/nayeNails.svg',
        texto_carrusel_secundario:
          'El compromiso principal es satisfacer las necesidades de nuestras clientas.',
        texto_direccion_unificado:
          '12 Avenida 2-25, Zona 6, Quetzaltenango, Guatemala',
        telefono_unificado: '+50249425739',
        url_facebook: 'https://facebook.com/profile.php?id=61575180189391',
        coordenadas_mapa: '14.850236,-91.510423',
        configuracion_colores: null,
        configuracion_servicios: null
      })
    }
    const config = rows[0]

    try {
      if (config.configuracion_colores) {
        config.configuracion_colores = JSON.parse(config.configuracion_colores)
      }
      if (config.configuracion_servicios) {
        config.configuracion_servicios = JSON.parse(
          config.configuracion_servicios
        )
      }
    } catch (parseError) {
      console.error('Error parseando JSON de configuraciones:', parseError)
      // Devolver los campos como strings si falla el parseo, o manejar el error como prefieras
    }

    return res.status(200).json(config)
  } catch (error) {
    console.error('Error al obtener TextosColoresConfiguraciones:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const updateTextosColoresConfig = async (req, res) => {
  const {
    nombre_negocio,
    slogan_negocio,
    logo_negocio_url,
    texto_carrusel_secundario,
    texto_direccion_unificado,
    telefono_unificado,
    url_facebook,
    coordenadas_mapa,
    configuracion_colores,
    configuracion_servicios
  } = req.body

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ message: 'Base de datos no disponible.' })
  }

  try {
    const coloresString =
      typeof configuracion_colores === 'string'
        ? configuracion_colores
        : JSON.stringify(configuracion_colores)

    const serviciosString =
      typeof configuracion_servicios === 'string'
        ? configuracion_servicios
        : JSON.stringify(configuracion_servicios)

    await db.execute({
      sql: `
        INSERT INTO TextosColoresConfiguraciones (
          id, nombre_negocio, slogan_negocio, logo_negocio_url, texto_carrusel_secundario,
          texto_direccion_unificado, telefono_unificado, url_facebook, coordenadas_mapa,
          configuracion_colores, configuracion_servicios, fecha_actualizacion
        ) VALUES (
          1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')
        )
        ON CONFLICT(id) DO UPDATE SET
          nombre_negocio = excluded.nombre_negocio,
          slogan_negocio = excluded.slogan_negocio,
          logo_negocio_url = excluded.logo_negocio_url,
          texto_carrusel_secundario = excluded.texto_carrusel_secundario,
          texto_direccion_unificado = excluded.texto_direccion_unificado,
          telefono_unificado = excluded.telefono_unificado,
          url_facebook = excluded.url_facebook,
          coordenadas_mapa = excluded.coordenadas_mapa,
          configuracion_colores = excluded.configuracion_colores,
          configuracion_servicios = excluded.configuracion_servicios,
          fecha_actualizacion = STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')
      `,
      args: [
        nombre_negocio,
        slogan_negocio,
        logo_negocio_url,
        texto_carrusel_secundario,
        texto_direccion_unificado,
        telefono_unificado,
        url_facebook,
        coordenadas_mapa,
        coloresString,
        serviciosString
      ]
    })

    const {
      rows: [updatedConfig]
    } = await db.execute({
      sql: 'SELECT * FROM TextosColoresConfiguraciones WHERE id = ?',
      args: [1]
    })

    try {
      if (updatedConfig.configuracion_colores) {
        updatedConfig.configuracion_colores = JSON.parse(
          updatedConfig.configuracion_colores
        )
      }
      if (updatedConfig.configuracion_servicios) {
        updatedConfig.configuracion_servicios = JSON.parse(
          updatedConfig.configuracion_servicios
        )
      }
    } catch (parseError) {
      console.error(
        'Error parseando JSON de configuraciones actualizadas:',
        parseError
      )
    }

    return res.status(200).json({
      message: 'Configuraciones de Textos y Colores guardadas exitosamente.',
      configuracion: updatedConfig
    })
  } catch (error) {
    console.error('Error al guardar TextosColoresConfiguraciones:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}
