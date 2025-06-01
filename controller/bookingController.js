const BookingOrder = require("../model/bookingOrder");
const BookingRoom = require("../model/bookingRoom");
const BookingService = require("../model/bookingService");
const Bill = require("../model/invoiceSchema");
const Transaction = require("../model/transaction");
const Invoice = require("../model/invoiceSchema"); // THÊM MỚI
const Customer = require("../model/customer");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

// Thêm vào đầu file bookingController.js
const parseGuestCount = (guestCountValue) => {
  // Nếu đã là number, trả về luôn
  if (typeof guestCountValue === "number") {
    return guestCountValue;
  }

  // Nếu là string, extract numbers và tính tổng
  if (typeof guestCountValue === "string") {
    const numbers = guestCountValue.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      return numbers.reduce((sum, num) => sum + parseInt(num), 0);
    }
  }

  // Default value nếu không parse được
  return 1;
};

// ==================== BOOKING ROOM FUNCTIONS ====================

// Tạo booking phòng (CẬP NHẬT - từ code cũ + cải thiện)
const createRoomBooking = asyncHandler(async (req, res) => {
  const {
    checkInDate,
    selectedRooms,
    totalPrice,
    yachtId,
    fullName,
    phoneNumber,
    email,
    requirements,
    guestCount,
    scheduleId,
    status = "consultation_requested",
  } = req.body;

  console.log("Booking request body:", req.body);

  if (
    !checkInDate ||
    !selectedRooms ||
    selectedRooms.length === 0 ||
    !yachtId ||
    !guestCount ||
    !totalPrice
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Thiếu thông tin bắt buộc: checkInDate, selectedRooms, yachtId, guestCount, hoặc totalPrice",
    });
  }

  if (!fullName || !phoneNumber || !email) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng điền đầy đủ thông tin liên hệ",
    });
  }

  if (!req.user._id) {
    return res.status(401).json({
      success: false,
      message: "Không tìm thấy thông tin tài khoản trong token",
    });
  }

  try {
    let customer = await Customer.findOne({ accountId: req.user._id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin khách hàng",
      });
    }

    const needUpdate =
      customer.fullName !== fullName ||
      customer.phoneNumber !== phoneNumber ||
      customer.email !== email;

    if (needUpdate) {
      customer.fullName = fullName;
      customer.phoneNumber = phoneNumber;
      customer.email = email;
      await customer.save();
    }

    const totalGuestCount = parseInt(guestCount, 10);
    if (isNaN(totalGuestCount) || totalGuestCount < 1) {
      return res.status(400).json({
        success: false,
        message: "Số lượng khách không hợp lệ",
      });
    }

    const newBookingOrder = new BookingOrder({
      customer: customer._id,
      yacht: yachtId,
      schedule: scheduleId || null,
      amount: totalPrice,
      status: status,
      requirements,
      guestCount: totalGuestCount,
      checkInDate: new Date(checkInDate),
      paymentStatus: "unpaid",
      totalPaid: 0,
      remainingAmount: totalPrice,
      consultationData: {
        requestedRooms: selectedRooms,
        estimatedPrice: totalPrice,
        status: "pending",
        createdAt: new Date(),
      },
    });

    const savedBookingOrder = await newBookingOrder.save();

    console.log("Created booking with ID:", savedBookingOrder._id.toString());

    res.status(201).json({
      success: true,
      message: "Tạo yêu cầu tư vấn thành công!",
      data: {
        bookingId: savedBookingOrder._id.toString(),
        status: savedBookingOrder.status,
        confirmationCode: savedBookingOrder.confirmationCode,
        totalAmount: totalPrice,
        customerInfo: {
          fullName: customer.fullName,
          phoneNumber: customer.phoneNumber,
          email: customer.email,
        },
      },
    });
  } catch (error) {
    console.error("Lỗi tạo booking:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo booking",
      error: error.message,
    });
  }
});
// Tạo yêu cầu tư vấn (GIỮ NGUYÊN - từ code cũ)
const createConsultation = asyncHandler(async (req, res) => {
  const {
    checkInDate,
    selectedRooms,
    totalPrice,
    yachtId,
    scheduleId,
    fullName,
    phoneNumber,
    email,
    requirements,
    guestCount,
  } = req.body;

  console.log("Consultation request body:", req.body);
  console.log("User from token:", req.user);

  // Validate dữ liệu
  if (!yachtId || !fullName || !phoneNumber || !email) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng điền đầy đủ thông tin để yêu cầu tư vấn",
    });
  }

  if (!req.user._id) {
    return res.status(401).json({
      success: false,
      message: "Không tìm thấy thông tin tài khoản trong token",
    });
  }

  try {
    let customer = await Customer.findOne({ accountId: req.user._id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin khách hàng",
      });
    }

    // Cập nhật thông tin customer nếu cần
    const needUpdate =
      customer.fullName !== fullName ||
      customer.phoneNumber !== phoneNumber ||
      customer.email !== email;

    if (needUpdate) {
      customer.fullName = fullName;
      customer.phoneNumber = phoneNumber;
      customer.email = email;
      await customer.save();
    }
    const totalGuestCount = parseGuestCount(guestCount);

    // Tạo consultation record
    const consultationRecord = new BookingOrder({
      customer: customer._id,
      yacht: yachtId,
      schedule: scheduleId || null,
      amount: totalPrice || 0,
      status: "consultation_requested",
      requirements,
      guestCount: totalGuestCount,
      checkInDate: checkInDate ? new Date(checkInDate) : null,
      consultationData: {
        requestedRooms: selectedRooms || [],
        estimatedPrice: totalPrice || 0,
        createdAt: new Date(),
        originalGuestCountText: guestCount,
      },
    });

    const savedConsultation = await consultationRecord.save();

    res.status(201).json({
      success: true,
      message:
        "Đăng ký tư vấn thành công! Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất.",
      data: {
        consultationId: savedConsultation._id,
        status: "consultation_requested",
        customerInfo: {
          fullName: customer.fullName,
          phoneNumber: customer.phoneNumber,
          email: customer.email,
        },
      },
    });
  } catch (error) {
    console.error("Lỗi tạo consultation:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo yêu cầu tư vấn",
      error: error.message,
    });
  }
});

// ==================== BOOKING STATUS MANAGEMENT ====================

// CẬP NHẬT STATUS BOOKING (CẬP NHẬT - từ code cũ + hoàn thiện)
const updateBookingStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = [
    "consultation_requested",
    "confirmed",
    "completed",
    "cancelled",
    "rejected",
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status không hợp lệ",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await BookingOrder.findByIdAndUpdate(
      id,
      { status },
      { new: true, session }
    ).populate("customer", "fullName phoneNumber email");

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Booking không tồn tại",
      });
    }

    // Kiểm tra quyền truy cập (nếu cần)
    const customer = await Customer.findOne({
      accountId: req.user._id,
    }).session(session);

    if (booking.customer._id.toString() !== customer._id.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Không có quyền cập nhật booking này",
      });
    }

    await session.commitTransaction();

    res.json({
      success: true,
      data: booking,
      message: `Booking đã được ${
        status === "confirmed"
          ? "xác nhận"
          : status === "cancelled"
          ? "hủy"
          : "cập nhật"
      }`,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    session.endSession();
  }
});

// XÁC NHẬN BOOKING (GIỮ NGUYÊN - từ code cũ)
const confirmBooking = asyncHandler(async (req, res) => {
  const { id } = req.params; // Chỉ lấy từ URL
  const { scheduleId } = req.body;

  console.log("Received confirm request:", { id, scheduleId });

  if (!id || !scheduleId) {
    return res.status(400).json({
      success: false,
      message: "Thiếu id hoặc scheduleId",
    });
  }

  try {
    const booking = await BookingOrder.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy booking với ID: ${id}`,
      });
    }

    console.log("Current booking state:", booking);

    if (booking.status !== "consultation_requested") {
      return res.status(400).json({
        success: false,
        message: `Booking không ở trạng thái consultation_requested để xác nhận (hiện tại: ${booking.status})`,
      });
    }

    booking.status = "confirmed";
    booking.schedule = scheduleId;
    booking.confirmedAt = new Date();

    const updatedBooking = await booking.save();

    console.log("Updated booking:", updatedBooking);

    res.status(200).json({
      success: true,
      message: "Booking đã được xác nhận!",
      data: {
        id: updatedBooking._id.toString(),
        status: updatedBooking.status,
        schedule: updatedBooking.schedule,
      },
    });
  } catch (error) {
    console.error("Lỗi xác nhận booking:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xác nhận booking",
      error: error.message,
    });
  }
});

// HỦY/TỪ CHỐI BOOKING (GIỮ NGUYÊN - từ code cũ)
const rejectBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await BookingOrder.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking không tồn tại",
      });
    }

    // Kiểm tra quyền truy cập
    const customer = await Customer.findOne({ accountId: req.user._id });
    if (booking.customer.toString() !== customer._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền hủy booking này",
      });
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    await booking.save();

    res.json({
      success: true,
      data: booking,
      message: "Booking đã được hủy",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== BOOKING RETRIEVAL FUNCTIONS ====================

// LẤY BOOKING VỚI TRANSACTIONS (CẬP NHẬT - từ code cũ + fix import)
const getBookingWithTransactions = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await BookingOrder.findById(id)
      .populate("customer", "fullName phoneNumber email")
      .populate("yacht", "name images location")
      .populate("schedule", "startDate endDate");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking không tồn tại",
      });
    }

    // Kiểm tra quyền truy cập
    const customer = await Customer.findOne({ accountId: req.user._id });
    if (booking.customer._id.toString() !== customer._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền truy cập booking này",
      });
    }

    // Lấy transactions liên quan
    const transactions = await Transaction.find({ bookingId: id }).sort({
      createdAt: -1,
    });

    // Lấy thông tin phòng đã book
    const bookedRooms = await BookingRoom.find({ bookingId: id }).populate(
      "roomId",
      "name price area description"
    );

    // Lấy thông tin bill/invoice
    const bill = await Bill.findOne({ bookingId: id });
    const invoices = await Invoice.find({ bookingId: id }).sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      data: {
        booking,
        transactions,
        bookedRooms,
        bill,
        invoices,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Lấy danh sách booking của customer (THÊM MỚI)
const getCustomerBookings = asyncHandler(async (req, res) => {
  try {
    const customer = await Customer.findOne({ accountId: req.user._id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin khách hàng",
      });
    }

    const bookings = await BookingOrder.find({
      customer: customer._id,
    })
      .populate("customer", "fullName phoneNumber email address")
      .populate("yacht", "name images location")
      .populate("schedule", "startDate endDate")
      .sort({ create_time: -1 });

    // Thêm thông tin transaction status cho mỗi booking
    const bookingsWithTransactions = await Promise.all(
      bookings.map(async (booking) => {
        const transactions = await Transaction.find({ bookingId: booking._id });
        const completedTransactions = transactions.filter(
          (t) => t.status === "completed"
        );

        return {
          ...booking.toObject(),
          transactions: transactions,
          hasCompletedPayment: completedTransactions.length > 0,
          totalPaidAmount: completedTransactions.reduce(
            (sum, t) => sum + t.amount,
            0
          ),
        };
      })
    );

    res.status(200).json({
      success: true,
      data: bookingsWithTransactions,
    });
  } catch (error) {
    console.error("Error getting customer bookings:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách booking",
      error: error.message,
    });
  }
});

// Lấy chi tiết booking (THÊM MỚI)
const getBookingDetail = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  try {
    const booking = await BookingOrder.findById(bookingId)
      .populate("customer", "fullName phoneNumber email address")
      .populate("yacht", "name images location")
      .populate("schedule", "startDate endDate");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy booking",
      });
    }

    // Kiểm tra quyền truy cập
    const customer = await Customer.findOne({ accountId: req.user._id });
    if (booking.customer._id.toString() !== customer._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền truy cập booking này",
      });
    }

    // Lấy thông tin phòng đã book
    const bookedRooms = await BookingRoom.find({ bookingId }).populate(
      "roomId",
      "name price area description"
    );

    // Lấy thông tin bill và transactions
    const bill = await Bill.findOne({ bookingId });
    const transactions = await Transaction.find({ bookingId }).sort({
      createdAt: -1,
    });
    const invoices = await Invoice.find({ bookingId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        booking,
        bookedRooms,
        bill,
        transactions,
        invoices,
        paymentSummary: {
          totalAmount: booking.amount,
          totalPaid: booking.totalPaid || 0,
          remainingAmount: booking.remainingAmount || booking.amount,
          paymentStatus: booking.paymentStatus || "unpaid",
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy chi tiết booking",
      error: error.message,
    });
  }
});

// ==================== UTILITY FUNCTIONS ====================

// Get available rooms for a yacht and schedule (THÊM MỚI)
const getRooms = asyncHandler(async (req, res) => {
  const { yachtId, scheduleId } = req.query;

  try {
    // Logic lấy rooms dựa trên yachtId và scheduleId
    // Cần implement logic check availability

    res.status(200).json({
      success: true,
      data: [], // Your room data
      message: "Lấy danh sách phòng thành công",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách phòng",
      error: error.message,
    });
  }
});

// Cập nhật thông tin customer (THÊM MỚI)
const updateCustomerInfo = asyncHandler(async (req, res) => {
  const { fullName, phoneNumber, email, address } = req.body;

  try {
    const customer = await Customer.findOne({ accountId: req.user._id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin khách hàng",
      });
    }

    // Cập nhật thông tin
    if (fullName) customer.fullName = fullName;
    if (phoneNumber) customer.phoneNumber = phoneNumber;
    if (email) customer.email = email;
    if (address) customer.address = address;

    await customer.save();

    res.status(200).json({
      success: true,
      message: "Cập nhật thông tin thành công",
      data: customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật thông tin",
      error: error.message,
    });
  }
});

// Hủy booking (THÊM MỚI)
const cancelBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  try {
    const booking = await BookingOrder.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy booking",
      });
    }

    // Kiểm tra quyền
    const customer = await Customer.findOne({ accountId: req.user._id });
    if (booking.customer.toString() !== customer._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền hủy booking này",
      });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Booking đã được hủy trước đó",
      });
    }

    // Kiểm tra xem có thể hủy không (dựa trên payment status)
    if (booking.paymentStatus === "fully_paid") {
      return res.status(400).json({
        success: false,
        message:
          "Không thể hủy booking đã thanh toán đầy đủ. Vui lòng liên hệ hỗ trợ.",
      });
    }

    // Cập nhật trạng thái
    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Hủy booking thành công",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi hủy booking",
      error: error.message,
    });
  }
});

// ==================== ADMIN FUNCTIONS (Bonus) ====================

// Lấy tất cả booking (for admin) (THÊM MỚI)
const getAllBookings = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 10, status, yachtId } = req.query;

    // Build filter query
    let filter = {};
    if (status && status !== "all") {
      filter.status = status;
    }
    if (yachtId) {
      filter.yacht = yachtId;
    }

    const bookings = await BookingOrder.find(filter)
      .populate("customer", "fullName phoneNumber email")
      .populate("yacht", "name location")
      .populate("schedule", "startDate endDate")
      .sort({ create_time: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await BookingOrder.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách booking",
      error: error.message,
    });
  }
});

// Cập nhật booking (for admin) (THÊM MỚI)
const updateBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const updateData = req.body;

  try {
    const booking = await BookingOrder.findByIdAndUpdate(
      bookingId,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("customer", "fullName phoneNumber email")
      .populate("yacht", "name location");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy booking",
      });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật booking thành công",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật booking",
      error: error.message,
    });
  }
});

// Get booking statistics (for admin) (THÊM MỚI)
const getBookingStats = asyncHandler(async (req, res) => {
  try {
    const stats = await BookingOrder.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$amount" },
        },
      },
    ]);

    const totalBookings = await BookingOrder.countDocuments();
    const totalRevenue = await BookingOrder.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats,
        totalBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thống kê booking",
      error: error.message,
    });
  }
});

module.exports = {
  createRoomBooking,
  createConsultation,
  updateBookingStatus,
  confirmBooking,
  rejectBooking,
  getBookingWithTransactions,
  getCustomerBookings,
  getBookingDetail,
  getRooms,
  updateCustomerInfo,
  cancelBooking,
  getAllBookings,
  updateBooking,
  getBookingStats,
};
