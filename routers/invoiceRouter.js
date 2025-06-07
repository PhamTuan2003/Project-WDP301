// routes/invoiceRoutes.js
const express = require("express");
const router = express.Router();
const invoiceController = require("../controller/invoiceController");
const { veryfiToken } = require("../middleware/authMiddleware");
router.get("/:id", veryfiToken, invoiceController.getInvoiceById);
router.get(
  "/by-transaction/:transactionId",
  veryfiToken,
  invoiceController.getInvoiceByTransaction
);
router.get("/:id/download", veryfiToken, invoiceController.downloadInvoicePDF);
router.get("/my-invoices", veryfiToken, invoiceController.getCustomerInvoices);

module.exports = router;
