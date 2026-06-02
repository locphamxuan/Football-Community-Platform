const { Router } = require('express');
const controller = require('../controllers/matchRequest.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { createMatchRequestSchema, submitResultSchema } = require('../validations/matchRequest.validation');

const router = Router();
router.use(authenticate);

router.post('/',         validate(createMatchRequestSchema), controller.createMatchRequest);
router.get('/',          controller.getMatchRequests);
router.get('/:id',       controller.getMatchRequestById);
router.patch('/:id/respond',  controller.respondToRequest);
router.patch('/:id/cancel',   controller.cancelRequest);
router.patch('/:id/result',   validate(submitResultSchema), controller.submitResult);

module.exports = router;
