import { filtrarDiseniosConFiltros } from '../utils/filtrarDisenios.js'

export const generatePreview = async (req, res) => {
  try {
    const disenio = await filtrarDiseniosConFiltros(req.query)

    const defaultTitle = 'Explora Diseños de Uñas Increíbles | Naye Nails'
    const defaultDescription =
      'Encuentra tu inspiración en nuestra galería de diseños de uñas. Diseños personalizados, colores vibrantes y las últimas tendencias te esperan.'
    const defaultImage =
      'https://res.cloudinary.com/drdkb6gjx/image/upload/v1724088857/cld-sample-5.jpg'
    const siteUrl = `${req.protocol}://${req.get('host')}`
    const fullUrl = `${siteUrl}${req.originalUrl}`

    const title = disenio?.nombre
      ? `${disenio.nombre} | Naye Nails`
      : defaultTitle
    const description = disenio?.descripcion || defaultDescription
    const image = disenio?.imagen_url || defaultImage

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
        </body>
      </html>
    `)
  } catch (error) {
    console.error('Error generando la vista previa:', error)
    res.status(500).send('Error al generar la vista previa.')
  }
}
