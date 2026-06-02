const multer = require('multer');
const { AppError } = require('./errorHandler');
const HttpStatus = require('../constants/httpStatus');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const fileFilter = (_req, file, cb) => {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(new AppError('Only JPEG, PNG, WebP images are allowed', HttpStatus.BAD_REQUEST, 'INVALID_FILE_TYPE'));
  }
  cb(null, true);
};

const storage = multer.memoryStorage();

const uploadSingle = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } }).single('image');

const uploadMultiple = (field = 'images', max = 8) =>
  multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } }).array(field, max);

module.exports = { uploadSingle, uploadMultiple };
