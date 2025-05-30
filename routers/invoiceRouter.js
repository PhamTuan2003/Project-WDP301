const express = require("express");
const router = express.Router();
const invoiceController = require("../controller/invoiceController");
const { veryfiToken } = require("../middleware/authMiddleware");

// Invoice routes
router.get(
  "/transaction/:transactionId",
  veryfiToken,
  invoiceController.getInvoiceByTransaction
);
router.get("/customer", veryfiToken, invoiceController.getCustomerInvoices);
router.get("/:id", veryfiToken, invoiceController.getInvoiceById);
router.get("/:id/pdf", veryfiToken, invoiceController.downloadInvoicePDF);

module.exports = router;
