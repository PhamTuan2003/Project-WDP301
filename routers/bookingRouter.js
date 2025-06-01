const express = require("express");

const {
  createRoomBooking,
  cancelBooking,
  confirmBooking,
  createConsultation,
  getBookingDetail,
  getBookingWithTransactions,
  getCustomerBookings,
  getRooms,
  updateCustomerInfo,
  updateBookingStatus,
  rejectBooking,
} = require("../controller/bookingController");
const { veryfiToken } = require("../middleware/authMiddleware");
const router = express.Router();
// Existing routes
router.post("/rooms", veryfiToken, createRoomBooking);
router.post("/consultation", veryfiToken, createConsultation);
router.get("/customer", veryfiToken, getCustomerBookings);
router.get("/:bookingId", veryfiToken, getBookingDetail);
router.get("/rooms/available", veryfiToken, getRooms);
router.put("/customer/info", veryfiToken, updateCustomerInfo);
router.patch("/:bookingId/cancel", veryfiToken, cancelBooking);

// NEW ROUTES
router.patch("/:id/status", veryfiToken, updateBookingStatus);
router.patch("/:id/confirm", veryfiToken, confirmBooking);
router.patch("/:id/reject", veryfiToken, rejectBooking);
router.get("/:id/transactions", veryfiToken, getBookingWithTransactions);

module.exports = router;
