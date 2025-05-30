const express = require("express");
const router = express.Router();
const bookingController = require("../controller/bookingController");
const auth = require("../middleware/authMiddleware");

// Existing routes
router.post("/rooms", auth, bookingController.createRoomBooking);
router.post("/consultation", auth, bookingController.createConsultation);
router.get("/customer", auth, bookingController.getCustomerBookings);
router.get("/:bookingId", auth, bookingController.getBookingDetail);
router.get("/rooms/available", auth, bookingController.getRooms);
router.put("/customer/info", auth, bookingController.updateCustomerInfo);
router.patch("/:bookingId/cancel", auth, bookingController.cancelBooking);

// NEW ROUTES
router.patch("/:id/status", auth, bookingController.updateBookingStatus);
router.patch("/:id/confirm", auth, bookingController.confirmBooking);
router.patch("/:id/reject", auth, bookingController.rejectBooking);
router.get(
  "/:id/transactions",
  auth,
  bookingController.getBookingWithTransactions
);

module.exports = router;
