const cloudinary = require('cloudinary').v2;
const env = require('./env');

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

const uploadImage = async (fileBuffer, mimetype, folder, options = {}) => {
  const dataUri = `data:${mimetype};base64,${fileBuffer.toString('base64')}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `football-platform/${folder}`,
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    ...options,
  });
  return { url: result.secure_url, publicId: result.public_id };
};

const uploadMultipleImages = async (files, folder) => {
  return Promise.all(
    files.map((f) => uploadImage(f.buffer, f.mimetype, folder))
  );
};

const deleteImage = async (publicId) => {
  await cloudinary.uploader.destroy(publicId);
};

module.exports = { cloudinary, uploadImage, uploadMultipleImages, deleteImage };
