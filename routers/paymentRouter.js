const express = require("express");

const {
  createDepositPayment,
  createFullPayment,
  handlePaymentCallback,
  simulatePaymentSuccess,
  getTransactionStatus,
} = require("../controller/paymentController");
const { veryfiToken } = require("../middleware/authMiddleware");
const router = express.Router();
// Payment routes
router.post("/deposit", veryfiToken, createDepositPayment);
router.post("/full", veryfiToken, createFullPayment);
router.post("/callback", handlePaymentCallback);

// Testing/Development routesS
router.post("/simulate/:transactionId", veryfiToken, simulatePaymentSuccess);
router.get("/transaction/:transactionId", veryfiToken, getTransactionStatus);

module.exports = router;
