const vnpay = require('./vnpay.provider');
const momo = require('./momo.provider');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');

const PROVIDERS = { vnpay, momo };

/**
 * @param {string} providerName
 * @returns {import('./provider.interface').PaymentProvider}
 */
const getProvider = (providerName) => {
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new AppError(`Unknown payment provider: ${providerName}`, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
  }
  if (!provider.isConfigured()) {
    throw new AppError(
      `Payment provider "${providerName}" is not configured`,
      HttpStatus.SERVICE_UNAVAILABLE,
      ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE
    );
  }
  return provider;
};

module.exports = { getProvider, PROVIDERS };
