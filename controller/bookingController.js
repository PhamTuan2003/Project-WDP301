const BookingOrder = require("../model/bookingOrder");
const BookingRoom = require("../model/bookingRoom");
const BookingService = require("../model/bookingService");
const Bill = require("../model/invoiceSchema");
const Transaction = require("../model/transaction");

const Customer = require("../model/customer");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

// Tạo booking phòng (CẬP NHẬT)
exports.createRoomBooking = asyncHandler(async (req, res) => {
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
    status = "confirmed", // MẶC ĐỊNH là confirmed cho "Book Now"
  } = req.body;

  console.log("Booking request body:", req.body);
  console.log("User from token:", req.user);

  // Validate dữ liệu đầu vào
  if (
    !checkInDate ||
    !selectedRooms ||
    selectedRooms.length === 0 ||
    !yachtId ||
    !scheduleId
  ) {
    return res.status(400).json({
      success: false,
      message: "Thiếu thông tin bắt buộc cho booking",
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

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Tìm customer bằng accountId
    let customer = await Customer.findOne({ accountId: req.user._id }).session(
      session
    );
    if (!customer) {
      await session.abortTransaction();
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
      await customer.save({ session });
    }

    // Tạo BookingOrder với status được truyền vào
    const newBookingOrder = new BookingOrder({
      customer: customer._id,
      yacht: yachtId,
      schedule: scheduleId,
      amount: totalPrice,
      status: status, // 'confirmed' for Book Now, 'pending' for consultation
      requirements,
      guestCount,
      checkInDate: new Date(checkInDate),
      paymentStatus: "unpaid",
      totalPaid: 0,
      remainingAmount: totalPrice,
    });

    const savedBookingOrder = await newBookingOrder.save({ session });

    // Tạo BookingRoom records
    const roomBookings = selectedRooms.map((room) => ({
      bookingId: savedBookingOrder._id,
      roomId: room.id || room._id,
      quantity: room.quantity,
      price: room.price,
      total: room.quantity * room.price,
    }));

    await BookingRoom.insertMany(roomBookings, { session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message:
        status === "confirmed"
          ? "Booking đã được xác nhận! Vui lòng tiến hành thanh toán."
          : "Tạo booking thành công!",
      data: {
        bookingId: savedBookingOrder._id,
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
    await session.abortTransaction();
    console.error("Lỗi tạo booking:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo booking",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
});

// CẬP NHẬT STATUS BOOKING (MỚI)
exports.updateBookingStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = [
    "pending",
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

// XÁC NHẬN BOOKING (MỚI)
exports.confirmBooking = asyncHandler(async (req, res) => {
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
        message: "Không có quyền xác nhận booking này",
      });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Booking không ở trạng thái pending",
      });
    }

    booking.status = "confirmed";
    await booking.save();

    res.json({
      success: true,
      data: booking,
      message: "Booking đã được xác nhận",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// HỦY/TỪ CHỐI BOOKING (MỚI)
exports.rejectBooking = asyncHandler(async (req, res) => {
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

// LẤY BOOKING VỚI TRANSACTIONS (MỚI)
exports.getBookingWithTransactions = asyncHandler(async (req, res) => {
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

// Các method khác giữ nguyên...
// (createConsultation, getCustomerBookings, getBookingDetail, getRooms, updateCustomerInfo, cancelBooking)
