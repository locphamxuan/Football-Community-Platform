const mongoose = require('mongoose');
const { sendError } = require('../utils/ApiResponse');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');
const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode = 500, code = ErrorCode.INTERNAL_ERROR) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  // Operational (known) errors
  if (err.isOperational) {
    return sendError(res, err.message, err.statusCode, err.code);
  }

  // Mongoose duplicate key (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return sendError(res, `${field} already exists`, HttpStatus.CONFLICT, ErrorCode.CONFLICT);
  }

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = {};
    Object.entries(err.errors).forEach(([k, v]) => { errors[k] = v.message; });
    return sendError(res, 'Validation failed', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, errors);
  }

  // Mongoose CastError (invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    return sendError(res, `Invalid ${err.path}: ${err.value}`, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
  }

  // Unknown errors
  logger.error('Unhandled error:', { message: err.message, stack: err.stack });
  return sendError(res, 'An unexpected error occurred', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR);
};

module.exports = { AppError, errorHandler };
