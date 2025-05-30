const express = require("express");
const router = express.Router();
const paymentController = require("../controller/paymentController");
const { veryfiToken } = require("../middleware/veryfiTokenMiddleware");

// Payment routes
router.post("/deposit", veryfiToken, paymentController.createDepositPayment);
router.post("/full", veryfiToken, paymentController.createFullPayment);
router.post("/callback", paymentController.handlePaymentCallback);

// Testing/Development routes
router.post(
  "/simulate/:transactionId",
  veryfiToken,
  paymentController.simulatePaymentSuccess
);
router.get(
  "/transaction/:transactionId",
  veryfiToken,
  paymentController.getTransactionStatus
);

module.exports = router;
