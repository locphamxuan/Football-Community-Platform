const { Router } = require('express');
const controller = require('../controllers/paymentWebhook.controller');

const router = Router();

// VNPay gọi cả hai bằng GET với query string đã ký — không JWT, không CSRF (server-to-server
// cho IPN; return URL chỉ điều hướng UX). Xem docs/02-kien-truc.md vì sao mount ngoài /api.
router.get('/vnpay/ipn', controller.vnpayIpn);
router.get('/vnpay/return', controller.vnpayReturn);

// MoMo: IPN là POST JSON body (khác VNPay dùng GET query), return URL vẫn là GET redirect.
router.post('/momo/ipn', controller.momoIpn);
router.get('/momo/return', controller.momoReturn);

module.exports = router;
