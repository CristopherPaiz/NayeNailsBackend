import multer from 'multer'
import streamifier from 'streamifier'
import cloudinary from '../config/cloudinary.config.js'

const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true)
  } else {
    cb(new Error('Solo se permiten archivos de imagen.'), false)
  }
}

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // Límite de 15MB
  fileFilter: fileFilter
})

export const handleUpload = (
  fieldName = 'imagen_disenio',
  cloudinaryFolder = 'naye_nails/disenios',
  customDimensions = null
) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
      if (err) {
        let message = 'Error al procesar la imagen.'
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE')
            message = 'La imagen es demasiado grande (máx 15MB).'
        } else if (err.message) {
          message = err.message
        }
        return res.status(400).json({ message })
      }

      if (!req.file) {
        return next()
      }

      try {
        const dimensions = customDimensions || { width: 1000, height: 1000 }

        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: cloudinaryFolder,
              format: 'webp',
              transformation: [
                {
                  width: dimensions.width,
                  height: dimensions.height,
                  crop: 'limit'
                },
                { quality: 'auto:good' }
              ]
            },
            (error, result) => {
              if (error) return reject(error)
              resolve(result)
            }
          )
          streamifier.createReadStream(req.file.buffer).pipe(uploadStream)
        })

        req.cloudinaryUploadResult = {
          secure_url: result.secure_url,
          public_id: result.public_id
        }
        next()
      } catch (uploadError) {
        console.error('Error al subir imagen a Cloudinary:', uploadError)
        return res
          .status(500)
          .json({ message: 'Error interno al subir la imagen.' })
      }
    })
  }
}

export const handleSiteConfigUpload = (fieldName = 'site_image') => {
  return handleUpload(fieldName, 'naye_nails/site_config_images', {
    width: 2000,
    height: 2000
  })
}

export const handleLocationImageUpload = (fieldName = 'location_image') => {
  return handleUpload(fieldName, 'naye_nails/location_images')
}

export const deleteCloudinaryImage = async (publicId) => {
  if (!publicId) return
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch (error) {
    console.error(`Error al eliminar imagen ${publicId} de Cloudinary:`, error)
  }
}
