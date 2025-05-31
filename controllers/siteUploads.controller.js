export const uploadSiteImage = async (req, res) => {
  if (!req.cloudinaryUploadResult) {
    return res.status(400).json({
      message: 'No se subió ninguna imagen o hubo un error en la carga.'
    })
  }
  res.status(200).json({
    message: 'Imagen subida exitosamente para configuración.',
    imageData: req.cloudinaryUploadResult
  })
}
