import { getDb } from '../database/connection.js'
import { filtrarDiseniosConFiltros } from '../utils/filtrarDisenios.js'
import { toSlug } from '../utils/textUtils.js'

const capitalize = (str) => {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const generateDynamicTitleFromFilters = (query, categorias) => {
  if (!query || Object.keys(query).length === 0 || !categorias) {
    return 'Explora Diseños de Uñas Increíbles'
  }

  const titleParts = []
  const filterOrder = [
    'servicios',
    'tipos',
    'colores',
    'decoraciones-y-efectos'
  ]

  filterOrder.forEach((filterKey) => {
    if (query[filterKey]) {
      const categoriaPadre = categorias.find(
        (cp) => toSlug(cp.nombre) === filterKey
      )
      if (categoriaPadre) {
        const values = Array.isArray(query[filterKey])
          ? query[filterKey]
          : [query[filterKey]]
        const displayValues = values
          .map((slug) => {
            const sub = categoriaPadre.subcategorias.find(
              (s) => toSlug(s.nombre) === slug
            )
            return sub
              ? capitalize(sub.nombre)
              : capitalize(slug.replace(/-/g, ' '))
          })
          .join(', ')
        titleParts.push(
          `${capitalize(categoriaPadre.nombre)}: ${displayValues}`
        )
      }
    }
  })

  if (titleParts.length === 0) {
    return 'Explora Diseños de Uñas Increíbles'
  }

  return titleParts.join(' | ')
}

const renderHtml = (res, title, description, image, fullUrl) => {
  res.setHeader('Content-Type', 'text/html')
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
        <meta name="description" content="${description}" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="${fullUrl}" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:image" content="${image}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="${fullUrl}" />
        <meta property="twitter:title" content="${title}" />
        <meta property="twitter:description" content="${description}" />
        <meta property="twitter:image" content="${image}" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <h1>${title}</h1>
        <p>${description}</p>
        <img src="${image}" alt="${title}" style="max-width: 100%; height: auto;" />
        <p>Serás redirigido en un momento...</p>
        <script>
          setTimeout(function() {
            window.location.href = "${fullUrl}";
          }, 1000);
        </script>
      </body>
    </html>
  `)
}

export const generateHomePreview = async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, '')
  const fullUrl = `${frontendUrl}${req.originalUrl}`
  try {
    const db = await getDb()
    const { rows } = await db.execute(
      'SELECT nombre_negocio, slogan_negocio, logo_negocio_url FROM TextosColoresConfiguraciones WHERE id = 1'
    )
    const config = rows[0]

    const title = config?.nombre_negocio || 'Naye Nails'
    const description =
      config?.slogan_negocio || 'Donde la perfeccion es el estándar'
    const image =
      'https://res.cloudinary.com/drdkb6gjx/image/upload/v1749846073/jc8udap3bfxjvwuxabxm.jpg'

    return renderHtml(res, title, description, image, fullUrl)
  } catch (error) {
    console.error('Error generando preview para Home:', error)
    return generateDefaultPreview(req, res)
  }
}

export const generateDefaultPreview = (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, '')
  const fullUrl = `${frontendUrl}${req.originalUrl}`
  const defaultTitle = 'Naye Nails | Salón de Uñas'
  const defaultDescription =
    'Descubre el arte en tus uñas. Diseños personalizados, colores vibrantes y las últimas tendencias.'
  const defaultImage =
    'https://res.cloudinary.com/drdkb6gjx/image/upload/v1749846073/jc8udap3bfxjvwuxabxm.jpg'
  return renderHtml(
    res,
    defaultTitle,
    defaultDescription,
    defaultImage,
    fullUrl
  )
}

export const generatePreview = async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, '')
  const fullUrl = `${frontendUrl}${req.originalUrl}`
  const { id } = req.params
  const { query } = req

  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).send('Servicio no disponible temporalmente.')
    }

    if (id) {
      const {
        rows: [disenio]
      } = await db.execute({
        sql: 'SELECT nombre, descripcion, imagen_url FROM Disenios WHERE id = ? AND activo = 1',
        args: [id]
      })

      if (disenio) {
        const title = `${disenio.nombre} | Naye Nails`
        const description =
          disenio.descripcion ||
          'Descubre este increíble diseño y muchos más en Naye Nails.'
        const image = disenio.imagen_url
        return renderHtml(res, title, description, image, fullUrl)
      }
    }

    const { rows: categorias } = await db.execute({
      sql: `
        SELECT cp.id, cp.nombre, s.nombre as sub_nombre
        FROM CategoriasPadre cp
        JOIN Subcategorias s ON cp.id = s.id_categoria_padre
        WHERE cp.activo = 1 AND s.activo = 1
      `
    })

    const categoriasAgrupadas = categorias.reduce((acc, row) => {
      const { id, nombre, sub_nombre } = row
      if (!acc[id]) {
        acc[id] = { id, nombre, subcategorias: [] }
      }
      acc[id].subcategorias.push({ nombre: sub_nombre })
      return acc
    }, {})
    const categoriasArray = Object.values(categoriasAgrupadas)

    const diseniosFiltrados = await filtrarDiseniosConFiltros(query)
    let disenioAleatorio = null
    if (diseniosFiltrados && diseniosFiltrados.length > 0) {
      const randomIndex = Math.floor(Math.random() * diseniosFiltrados.length)
      disenioAleatorio = diseniosFiltrados[randomIndex]
    } else {
      const {
        rows: [random]
      } = await db.execute(
        'SELECT imagen_url FROM Disenios WHERE activo = 1 ORDER BY RANDOM() LIMIT 1'
      )
      if (random) disenioAleatorio = { imagen_url: random.imagen_url }
    }

    const image =
      disenioAleatorio?.imagen_url ||
      'https://res.cloudinary.com/drdkb6gjx/image/upload/v1749846755/v4hwvg6dwu5eotyrzp9t.jpg'
    const title = `${generateDynamicTitleFromFilters(
      query,
      categoriasArray
    )} | Naye Nails`
    const description =
      'Encuentra tu inspiración en nuestra galería de diseños. Diseños personalizados, colores vibrantes y las últimas tendencias te esperan.'

    return renderHtml(res, title, description, image, fullUrl)
  } catch (error) {
    console.error('Error generando la vista previa:', error)
    return generateDefaultPreview(req, res)
  }
}
