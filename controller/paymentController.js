const Transaction = require("../model/transaction");
const BookingOrder = require("../model/bookingOrder");
const Invoice = require("../model/invoice");
const BookingRoom = require("../model/bookingRoom");
const Customer = require("../model/customer");
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");

// Tạo deposit payment (20%)
exports.createDepositPayment = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId } = req.body;

    // Tìm booking và validate
    const booking = await BookingOrder.findById(bookingId)
      .populate("customer")
      .session(session);

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Booking không tồn tại",
      });
    }

    // Kiểm tra quyền truy cập
    const customer = await Customer.findOne({
      accountId: req.user._id,
    }).session(session);
    if (booking.customer._id.toString() !== customer._id.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Không có quyền truy cập booking này",
      });
    }

    if (booking.status !== "confirmed") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Booking chưa được xác nhận",
      });
    }

    // Kiểm tra đã có deposit chưa
    const existingDeposit = await Transaction.findOne({
      bookingId,
      transaction_type: "deposit",
      status: { $in: ["pending", "completed"] },
    }).session(session);

    if (existingDeposit) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Đã có giao dịch cọc cho booking này",
      });
    }

    // Tính tiền cọc 20%
    const depositAmount = Math.round(booking.amount * 0.2);

    // Tạo transaction
    const transaction = new Transaction({
      bookingId,
      amount: depositAmount,
      transaction_type: "deposit",
      status: "pending",
    });

    await transaction.save({ session });

    // Generate QR code (mock - thay bằng real payment gateway)
    const qrCodeUrl = await generateQRCode(depositAmount, transaction._id);
    transaction.qr_code_url = qrCodeUrl;
    await transaction.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      data: {
        transaction,
        qrCodeUrl,
        amount: depositAmount,
        formattedAmount: depositAmount.toLocaleString("vi-VN") + " VNĐ",
        bookingInfo: {
          confirmationCode: booking.confirmationCode,
          totalAmount: booking.amount,
        },
      },
      message: "Tạo QR code thanh toán cọc thành công",
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating deposit payment:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo thanh toán cọc",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
});

// Tạo full payment
exports.createFullPayment = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId } = req.body;

    const booking = await BookingOrder.findById(bookingId)
      .populate("customer")
      .session(session);

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Booking không tồn tại",
      });
    }

    // Kiểm tra quyền truy cập
    const customer = await Customer.findOne({
      accountId: req.user._id,
    }).session(session);
    if (booking.customer._id.toString() !== customer._id.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Không có quyền truy cập booking này",
      });
    }

    if (booking.status !== "confirmed") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Booking chưa được xác nhận",
      });
    }

    // Kiểm tra đã có full payment chưa
    const existingFullPayment = await Transaction.findOne({
      bookingId,
      transaction_type: "full_payment",
      status: { $in: ["pending", "completed"] },
    }).session(session);

    if (existingFullPayment) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Đã có giao dịch thanh toán đầy đủ cho booking này",
      });
    }

    // Tạo transaction cho full payment
    const transaction = new Transaction({
      bookingId,
      amount: booking.amount,
      transaction_type: "full_payment",
      status: "pending",
    });

    await transaction.save({ session });

    // Generate QR code
    const qrCodeUrl = await generateQRCode(booking.amount, transaction._id);
    transaction.qr_code_url = qrCodeUrl;
    await transaction.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      data: {
        transaction,
        qrCodeUrl,
        amount: booking.amount,
        formattedAmount: booking.amount.toLocaleString("vi-VN") + " VNĐ",
        bookingInfo: {
          confirmationCode: booking.confirmationCode,
          totalAmount: booking.amount,
        },
      },
      message: "Tạo QR code thanh toán đầy đủ thành công",
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating full payment:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo thanh toán đầy đủ",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
});

// Xử lý payment callback từ gateway
exports.handlePaymentCallback = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { transactionId, status, gateway_response } = req.body;

    const transaction = await Transaction.findById(transactionId)
      .populate({
        path: "bookingId",
        populate: {
          path: "customer",
        },
      })
      .session(session);

    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Transaction không tồn tại",
      });
    }

    // Cập nhật transaction
    transaction.status = status;
    transaction.payment_gateway_response = gateway_response || {};

    if (status === "completed") {
      transaction.completedAt = new Date();

      // Cập nhật booking
      const booking = transaction.bookingId;
      booking.totalPaid += transaction.amount;

      if (transaction.transaction_type === "deposit") {
        booking.paymentStatus = "deposit_paid";
        booking.depositAmount = transaction.amount;
      } else if (transaction.transaction_type === "full_payment") {
        booking.paymentStatus = "fully_paid";
        booking.status = "completed";
      }

      await booking.save({ session });
      await transaction.save({ session });

      // Tạo invoice
      const invoice = await createInvoice(transaction._id, session);

      await session.commitTransaction();

      res.json({
        success: true,
        data: {
          transaction,
          booking,
          invoice,
        },
        message: "Thanh toán thành công!",
      });
    } else {
      transaction.failureReason = gateway_response?.error || "Payment failed";
      await transaction.save({ session });
      await session.commitTransaction();

      res.json({
        success: false,
        message: "Thanh toán thất bại",
        data: {
          transaction,
          reason: transaction.failureReason,
        },
      });
    }
  } catch (error) {
    await session.abortTransaction();
    console.error("Error handling payment callback:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xử lý callback thanh toán",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
});

// Simulate payment success (for testing)
exports.simulatePaymentSuccess = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  try {
    const result = await exports.handlePaymentCallback(
      {
        body: {
          transactionId,
          status: "completed",
          gateway_response: {
            success: true,
            timestamp: new Date().toISOString(),
          },
        },
      },
      res
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get transaction status
exports.getTransactionStatus = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  try {
    const transaction = await Transaction.findById(transactionId).populate({
      path: "bookingId",
      populate: {
        path: "customer",
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction không tồn tại",
      });
    }

    // Kiểm tra quyền truy cập
    const customer = await Customer.findOne({ accountId: req.user._id });
    if (
      transaction.bookingId.customer._id.toString() !== customer._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền truy cập transaction này",
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Mock QR code generation - thay bằng real payment gateway
const generateQRCode = async (amount, transactionId) => {
  // Integrate với VNPay, MoMo, ZaloPay, etc.
  // Ví dụ với VNPay:
  /*
  const vnpayConfig = {
    vnp_TmnCode: process.env.VNP_TMN_CODE,
    vnp_HashSecret: process.env.VNP_HASH_SECRET,
    vnp_Url: process.env.VNP_URL,
    vnp_ReturnUrl: process.env.VNP_RETURN_URL
  };
  
  const vnpay = new VNPay(vnpayConfig);
  const qrCode = await vnpay.generateQRCode({
    amount,
    orderId: transactionId,
    orderDescription: `Thanh toán booking ${transactionId}`
  });
  
  return qrCode.qr_data_url;
  */

  // Mock implementation
  return `https://api.paymentgateway.com/qr/${transactionId}?amount=${amount}`;
};

// Tạo invoice từ transaction
const createInvoice = async (transactionId, session) => {
  try {
    const transaction = await Transaction.findById(transactionId)
      .populate({
        path: "bookingId",
        populate: [
          { path: "customer" },
          { path: "yacht" },
          { path: "schedule" },
        ],
      })
      .session(session);

    const booking = transaction.bookingId;

    // Lấy thông tin phòng đã đặt
    const bookedRooms = await BookingRoom.find({ bookingId: booking._id })
      .populate("roomId")
      .session(session);

    const invoice = new Invoice({
      bookingId: booking._id,
      transactionId: transaction._id,
      customerInfo: {
        fullName: booking.customer.fullName,
        email: booking.customer.email,
        phoneNumber: booking.customer.phoneNumber,
        address: booking.customer.address,
      },
      yachtInfo: {
        name: booking.yacht?.name,
        location: booking.yacht?.location,
        scheduleInfo: booking.schedule
          ? `${booking.schedule.startDate} - ${booking.schedule.endDate}`
          : "",
      },
      items: bookedRooms.map((room) => ({
        roomId: room.roomId._id,
        roomName: room.roomId.name,
        quantity: room.quantity,
        unitPrice: room.price,
        totalPrice: room.total,
        description: room.roomId.description,
      })),
      subtotal: booking.amount,
      total: booking.amount,
      paidAmount: transaction.amount,
    });

    await invoice.save({ session });
    return invoice;
  } catch (error) {
    console.error("Error creating invoice:", error);
    throw error;
  }
};
