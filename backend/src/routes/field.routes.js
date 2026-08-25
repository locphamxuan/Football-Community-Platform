const { Router } = require('express');
const controller = require('../controllers/field.controller');
const pricingController = require('../controllers/fieldPricing.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const parseJsonFields = require('../middleware/parseJsonFields');
const { uploadMultiple } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const Role = require('../constants/roles');
const {
  createFieldSchema, updateFieldSchema,
  createSubFieldSchema, updateSubFieldSchema, availabilityQuerySchema, verifyFieldSchema,
  createPriceOverrideSchema, createPromotionSchema, updatePromotionSchema, priceQuoteQuerySchema,
} = require('../validations/field.validation');

const router = Router();

// Các field object/array được client gửi dạng JSON string trong multipart body
const FIELD_JSON_KEYS = ['location', 'pricing', 'operatingHours', 'amenities', 'rules', 'removeImages'];

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/',                  controller.getFields);
router.get('/owner/my-fields',   authenticate, authorize(Role.FIELD_OWNER, Role.ADMIN), controller.getMyFields);
router.get('/:id',               controller.getFieldById);
router.get('/:id/availability',  validate(availabilityQuerySchema, 'query'), controller.checkAvailability);
router.get('/:id/price-quote',   validate(priceQuoteQuerySchema, 'query'), pricingController.getPriceQuote);

// ── Field owner ───────────────────────────────────────────────────────────────
router.post('/',
  authenticate, authorize(Role.FIELD_OWNER),
  uploadLimiter, uploadMultiple('images', 8),
  parseJsonFields(FIELD_JSON_KEYS), validate(createFieldSchema),
  controller.createField
);
router.patch('/:id',
  authenticate, authorize(Role.FIELD_OWNER, Role.ADMIN),
  uploadLimiter, uploadMultiple('images', 8),
  parseJsonFields(FIELD_JSON_KEYS), validate(updateFieldSchema),
  controller.updateField
);
router.delete('/:id', authenticate, authorize(Role.FIELD_OWNER, Role.ADMIN), controller.deleteField);

// ── Sub-fields ────────────────────────────────────────────────────────────────
router.post('/:id/sub-fields',              authenticate, authorize(Role.FIELD_OWNER), validate(createSubFieldSchema), controller.addSubField);
router.patch('/:id/sub-fields/:subFieldId', authenticate, authorize(Role.FIELD_OWNER), validate(updateSubFieldSchema), controller.updateSubField);
router.delete('/:id/sub-fields/:subFieldId', authenticate, authorize(Role.FIELD_OWNER), controller.deleteSubField);

// ── Giá theo ngày & khuyến mãi ──────────────────────────────────────────────────
router.post('/:id/price-overrides',
  authenticate, authorize(Role.FIELD_OWNER), validate(createPriceOverrideSchema), pricingController.addPriceOverride
);
router.delete('/:id/price-overrides/:overrideId',
  authenticate, authorize(Role.FIELD_OWNER), pricingController.deletePriceOverride
);
router.post('/:id/promotions',
  authenticate, authorize(Role.FIELD_OWNER), validate(createPromotionSchema), pricingController.addPromotion
);
router.patch('/:id/promotions/:promoId',
  authenticate, authorize(Role.FIELD_OWNER), validate(updatePromotionSchema), pricingController.updatePromotion
);
router.delete('/:id/promotions/:promoId',
  authenticate, authorize(Role.FIELD_OWNER), pricingController.deletePromotion
);

// ── Duyệt sân ─────────────────────────────────────────────────────────────────
router.patch('/:id/submit', authenticate, authorize(Role.FIELD_OWNER), controller.submitForApproval);
router.patch('/:id/verify', authenticate, authorize(Role.ADMIN), validate(verifyFieldSchema), controller.verifyField);

module.exports = router;
