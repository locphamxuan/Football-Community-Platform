const fieldService = require('../services/field.service');
const { sendSuccess, paginationMeta } = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');
const HttpStatus = require('../constants/httpStatus');

const getFields = catchAsync(async (req, res) => {
  const { fields, total, page, limit } = await fieldService.getFields(req.query);
  sendSuccess(res, { fields }, 'Fields retrieved', HttpStatus.OK, { pagination: paginationMeta(total, page, limit) });
});

const getFieldById = catchAsync(async (req, res) => {
  const field = await fieldService.getFieldById(req.params.id);
  sendSuccess(res, { field });
});

const getMyFields = catchAsync(async (req, res) => {
  const fields = await fieldService.getMyFields(req.user.id);
  sendSuccess(res, { fields });
});

const createField = catchAsync(async (req, res) => {
  const files = req.files || [];
  const field = await fieldService.createField(req.user.id, req.body, files);
  sendSuccess(res, { field }, 'Field created successfully', HttpStatus.CREATED);
});

const updateField = catchAsync(async (req, res) => {
  const isAdmin = req.user.roles.includes('admin');
  const files = req.files || [];
  const field = await fieldService.updateField(req.params.id, req.user.id, req.body, files, isAdmin);
  sendSuccess(res, { field }, 'Field updated');
});

const deleteField = catchAsync(async (req, res) => {
  const isAdmin = req.user.roles.includes('admin');
  await fieldService.deleteField(req.params.id, req.user.id, isAdmin);
  sendSuccess(res, null, 'Field deleted');
});

const checkAvailability = catchAsync(async (req, res) => {
  const availability = await fieldService.checkAvailability(req.params.id, req.query);
  sendSuccess(res, { availability });
});

const addSubField = catchAsync(async (req, res) => {
  const field = await fieldService.addSubField(req.params.id, req.user.id, req.body);
  sendSuccess(res, { field }, 'Sub-field added', HttpStatus.CREATED);
});

const updateSubField = catchAsync(async (req, res) => {
  const field = await fieldService.updateSubField(req.params.id, req.params.subFieldId, req.user.id, req.body);
  sendSuccess(res, { field }, 'Sub-field updated');
});

const deleteSubField = catchAsync(async (req, res) => {
  const field = await fieldService.deleteSubField(req.params.id, req.params.subFieldId, req.user.id);
  sendSuccess(res, { field }, 'Sub-field deleted');
});

const verifyField = catchAsync(async (req, res) => {
  const approve = req.body.approve !== false;
  const field = await fieldService.verifyField(req.params.id, { approve, note: req.body.note }, req.user.id);
  sendSuccess(res, { field }, approve ? 'Field approved' : 'Field rejected');
});

const submitForApproval = catchAsync(async (req, res) => {
  const field = await fieldService.submitForApproval(req.params.id, req.user.id);
  sendSuccess(res, { field }, 'Field submitted for approval');
});

module.exports = {
  getFields, getFieldById, getMyFields, createField, updateField, deleteField,
  checkAvailability, addSubField, updateSubField, deleteSubField,
  verifyField, submitForApproval,
};
