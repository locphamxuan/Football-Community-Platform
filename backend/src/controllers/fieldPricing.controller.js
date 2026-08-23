const fieldPricingService = require('../services/fieldPricing.service');
const bookingService = require('../services/booking.service');
const { sendSuccess } = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');
const HttpStatus = require('../constants/httpStatus');

const isAdminUser = (req) => req.user.roles.includes('admin');

const addPriceOverride = catchAsync(async (req, res) => {
  const field = await fieldPricingService.addPriceOverride(req.params.id, req.user.id, req.body, isAdminUser(req));
  sendSuccess(res, { field }, 'Price override added', HttpStatus.CREATED);
});

const deletePriceOverride = catchAsync(async (req, res) => {
  const field = await fieldPricingService.deletePriceOverride(
    req.params.id, req.params.overrideId, req.user.id, isAdminUser(req)
  );
  sendSuccess(res, { field }, 'Price override deleted');
});

const addPromotion = catchAsync(async (req, res) => {
  const field = await fieldPricingService.addPromotion(req.params.id, req.user.id, req.body, isAdminUser(req));
  sendSuccess(res, { field }, 'Promotion added', HttpStatus.CREATED);
});

const updatePromotion = catchAsync(async (req, res) => {
  const field = await fieldPricingService.updatePromotion(
    req.params.id, req.params.promoId, req.user.id, req.body, isAdminUser(req)
  );
  sendSuccess(res, { field }, 'Promotion updated');
});

const deletePromotion = catchAsync(async (req, res) => {
  const field = await fieldPricingService.deletePromotion(
    req.params.id, req.params.promoId, req.user.id, isAdminUser(req)
  );
  sendSuccess(res, { field }, 'Promotion deleted');
});

const getPriceQuote = catchAsync(async (req, res) => {
  const { date, startTime, endTime, promoCode } = req.query;
  const quote = await bookingService.previewBookingPrice(req.params.id, date, startTime, endTime, promoCode);
  sendSuccess(res, quote);
});

module.exports = {
  addPriceOverride, deletePriceOverride,
  addPromotion, updatePromotion, deletePromotion,
  getPriceQuote,
};
