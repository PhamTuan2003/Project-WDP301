const express = require("express");

const {
  getCustomerInvoices,
  downloadInvoicePDF,
  getInvoiceById,
  getInvoiceByTransaction,
} = require("../controller/invoiceController");
const { veryfiToken } = require("../middleware/authMiddleware");
const router = express.Router();
// Invoice routes
router.get("/transaction/:transactionId", veryfiToken, getInvoiceByTransaction);
router.get("/customer", veryfiToken, getCustomerInvoices);
router.get("/:id", veryfiToken, getInvoiceById);
router.get("/:id/pdf", veryfiToken, downloadInvoicePDF);

module.exports = router;
