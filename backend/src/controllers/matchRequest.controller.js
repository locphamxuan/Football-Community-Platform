const matchRequestService = require('../services/matchRequest.service');
const { sendSuccess, paginationMeta } = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');
const HttpStatus = require('../constants/httpStatus');

const createMatchRequest = catchAsync(async (req, res) => {
  const request = await matchRequestService.createMatchRequest(req.user.id, req.body);
  sendSuccess(res, { request }, 'Match request sent', HttpStatus.CREATED);
});

const getMatchRequests = catchAsync(async (req, res) => {
  const { requests, total, page, limit } = await matchRequestService.getMatchRequests(req.user.id, req.query);
  sendSuccess(res, { requests }, 'Match requests retrieved', HttpStatus.OK, { pagination: paginationMeta(total, page, limit) });
});

const getMatchRequestById = catchAsync(async (req, res) => {
  const request = await matchRequestService.getMatchRequestById(req.params.id);
  sendSuccess(res, { request });
});

const respondToRequest = catchAsync(async (req, res) => {
  const request = await matchRequestService.respondToRequest(req.params.id, req.user.id, req.body.accept);
  sendSuccess(res, { request }, req.body.accept ? 'Request accepted' : 'Request rejected');
});

const cancelRequest = catchAsync(async (req, res) => {
  const request = await matchRequestService.cancelRequest(req.params.id, req.user.id);
  sendSuccess(res, { request }, 'Request cancelled');
});

const submitResult = catchAsync(async (req, res) => {
  const request = await matchRequestService.submitResult(req.params.id, req.user.id, req.body);
  sendSuccess(res, { request }, 'Result submitted');
});

module.exports = { createMatchRequest, getMatchRequests, getMatchRequestById, respondToRequest, cancelRequest, submitResult };
