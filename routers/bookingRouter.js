// routes/bookingRoutes.js
const express = require("express");
const router = express.Router();

const bookingController = require("../controller/bookingController");
const {
  createBookingOrConsultationRequest,
  getCustomerBookings,
  getCustomerBookingDetail,
  customerCancelBooking,
  getRooms,
  updateCustomerInfo,
  customerConfirmBookingAfterConsultation,
  getConsultationRequest,
  updateBookingOrConsultationRequest,
  cancelConsultationRequest,
} = bookingController;
const { veryfiToken } = require("../middleware/authMiddleware"); // Assuming you have this
const {
  sendBookingConfirmationEmail,
  testSendMail,
} = require("../utils/sendMail");

// ==================== BOOKING CREATION & CONSULTATION ====================
router.post("/request", veryfiToken, createBookingOrConsultationRequest);
router.put(
  "/request/:bookingId",
  veryfiToken,
  updateBookingOrConsultationRequest
);
router.post(
  "/:bookingId/confirm-consultation",
  veryfiToken,
  customerConfirmBookingAfterConsultation
);
router.get("/consultation", veryfiToken, getConsultationRequest);
router.delete(
  "/consultation/:bookingId",
  veryfiToken,
  cancelConsultationRequest
);
router.get("/my-bookings", veryfiToken, getCustomerBookings);
// Lấy chi tiết một booking của khách hàng đang đăng nhập
router.get("/:bookingId/my-detail", veryfiToken, getCustomerBookingDetail);

// ==================== CUSTOMER: CANCEL BOOKING ====================
// Khách hàng hủy booking của chính mình
router.put("/:bookingId/cancel", veryfiToken, customerCancelBooking);

// ==================== UTILITY / RELATED INFO (Có thể cần cho KH) ====================
// Lấy danh sách phòng (chưa có logic hoàn chỉnh trong controller) - có thể không cần veryfiToken nếu thông tin phòng là public
router.get("/available-rooms", getRooms); // Đổi tên route cho rõ hơn

// Khách hàng cập nhật thông tin cá nhân của họ
router.put("/customer/my-info", veryfiToken, updateCustomerInfo);

// Route test gửi email
router.get("/test-send-mail", async (req, res) => {
  const { to } = req.query;
  try {
    const info = await testSendMail(to);
    res.json({ success: true, message: "Đã gửi email test thành công!", info });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
