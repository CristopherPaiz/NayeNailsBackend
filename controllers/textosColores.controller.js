import { getDb } from '../database/connection.js'
import { deleteCloudinaryImage } from '../middlewares/upload.middleware.js'

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
        configuracion_servicios: null,
        horario_negocio: 'Lunes a Viernes: 9:00 AM - 5:00 PM', // Valor por defecto
        imagen_ubicacion_url: '/pics/local.png', // Valor por defecto
        imagen_ubicacion_public_id: null // Valor por defecto
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
    configuracion_servicios,
    horario_negocio, // Nuevo campo
    imagen_ubicacion_url, // Nuevo campo
    imagen_ubicacion_public_id // Nuevo campo
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

    // Obtener la configuración actual para manejar la imagen de ubicación
    const {
      rows: [currentConfig]
    } = await db.execute({
      sql: 'SELECT imagen_ubicacion_url, imagen_ubicacion_public_id FROM TextosColoresConfiguraciones WHERE id = ?',
      args: [1]
    })

    let finalImageUrl = imagen_ubicacion_url
    let finalImagePublicId = imagen_ubicacion_public_id
    let oldPublicIdToDelete = null

    if (
      imagen_ubicacion_url &&
      currentConfig &&
      imagen_ubicacion_url !== currentConfig.imagen_ubicacion_url
    ) {
      // Si la URL de la imagen de ubicación cambió y había una anterior con public_id, marcarla para borrar
      if (currentConfig.imagen_ubicacion_public_id) {
        oldPublicIdToDelete = currentConfig.imagen_ubicacion_public_id
      }
    } else if (
      !imagen_ubicacion_url &&
      currentConfig &&
      currentConfig.imagen_ubicacion_url
    ) {
      // Si la URL se eliminó (es null o vacía) y había una imagen antes
      if (currentConfig.imagen_ubicacion_public_id) {
        oldPublicIdToDelete = currentConfig.imagen_ubicacion_public_id
      }
      finalImageUrl = null // Asegurar que se guarda como null
      finalImagePublicId = null // Asegurar que se guarda como null
    }

    await db.execute({
      sql: `
        INSERT INTO TextosColoresConfiguraciones (
          id, nombre_negocio, slogan_negocio, logo_negocio_url, texto_carrusel_secundario,
          texto_direccion_unificado, telefono_unificado, url_facebook, coordenadas_mapa,
          configuracion_colores, configuracion_servicios, fecha_actualizacion,
          horario_negocio, imagen_ubicacion_url, imagen_ubicacion_public_id
        ) VALUES (
          1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'), ?, ?, ?
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
          fecha_actualizacion = STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'),
          horario_negocio = excluded.horario_negocio,
          imagen_ubicacion_url = excluded.imagen_ubicacion_url,
          imagen_ubicacion_public_id = excluded.imagen_ubicacion_public_id
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
        serviciosString,
        horario_negocio,
        finalImageUrl, // Usar la URL final
        finalImagePublicId // Usar el public_id final
      ]
    })

    if (oldPublicIdToDelete && oldPublicIdToDelete !== finalImagePublicId) {
      await deleteCloudinaryImage(oldPublicIdToDelete)
    }

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
