const Transaction = require("../model/transaction");
const BookingOrder = require("../model/bookingOrder");
const Invoice = require("../model/invoiceSchema");
const BookingRoom = require("../model/bookingRoom");
const Customer = require("../model/customer"); // For authorization
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const momoService = require("../services/momoService");
const vnpayService = require("../services/vnpayService");

const validatePaymentRequest = (req, res, next) => {
  const { bookingId, paymentMethod } = req.body;

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return res.status(400).json({
      success: false,
      message: "Booking ID không hợp lệ.",
    });
  }

  if (
    !paymentMethod ||
    !["vnpay", "momo", "bank_transfer"].includes(paymentMethod)
  ) {
    return res.status(400).json({
      success: false,
      message: "Phương thức thanh toán không hợp lệ.",
    });
  }

  if (!req.user.customerId) {
    return res.status(401).json({
      success: false,
      message: "Yêu cầu xác thực.",
    });
  }

  next();
};

// Helper function to create Invoice
const createInvoiceForTransaction = async (transactionId, session) => {
  try {
    const transaction = await Transaction.findById(transactionId)
      .populate({
        path: "bookingId",
        populate: [
          { path: "customer" },
          { path: "yacht", select: "name location" },
          { path: "schedule", select: "startDate endDate" },
        ],
      })
      .session(session);

    if (!transaction || !transaction.bookingId) {
      throw new Error(
        "Transaction hoặc BookingOrder liên kết không tìm thấy để tạo hóa đơn."
      );
    }
    const booking = transaction.bookingId;
    const customer = booking.customer;

    // Lấy các phòng đã được chốt trong booking (từ consultationData.requestedRooms)
    let invoiceItems = [];
    if (
      booking.consultationData &&
      booking.consultationData.requestedRooms &&
      booking.consultationData.requestedRooms.length > 0
    ) {
      invoiceItems = booking.consultationData.requestedRooms.map((roomData) => {
        return {
          type: "room",
          name: roomData.name || "Phòng đặt",
          description: roomData.description || "",
          quantity: roomData.quantity,
          unitPrice: roomData.price / roomData.quantity,
          totalPrice: roomData.price,
        };
      });
    } else {
      invoiceItems.push({
        type: "service",
        name: `Dịch vụ đặt du thuyền ${booking.bookingCode}`,
        quantity: 1,
        unitPrice: booking.amount,
        totalPrice: booking.amount,
      });
    }

    const newInvoice = new Invoice({
      bookingId: booking._id,
      transactionId: transaction._id,
      customerInfo: {
        customerId: customer._id,
        fullName: booking.customerInfo?.fullName || customer.fullName,
        email: booking.customerInfo?.email || customer.email,
        phoneNumber: booking.customerInfo?.phoneNumber || customer.phoneNumber,
        address: booking.customerInfo?.address || customer.address || "",
      },
      yachtInfo: {
        yachtId: booking.yacht?._id,
        name: booking.yacht?.name,
        location: booking.yacht?.location,
        scheduleInfo: booking.schedule
          ? `${booking.schedule.startDate?.toLocaleDateString()} - ${booking.schedule.endDate?.toLocaleDateString()}`
          : "",
        checkInDate: booking.checkInDate,
      },
      items: invoiceItems,
      financials: {
        subtotal: invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0),
        totalTax: 0,
        totalDiscount: 0,
        total: invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0),
        paidAmount: transaction.amount,
        remainingAmount: 0,
      },
      issueDate: new Date(),
    });

    const savedInvoice = await newInvoice.save({ session });
    console.log(
      `Hóa đơn ${savedInvoice.invoiceNumber} đã được tạo cho giao dịch ${transactionId}`
    );
    return savedInvoice;
  } catch (error) {
    console.error("Lỗi khi tạo hóa đơn:", error);
    throw error;
  }
};

// Helper xử lý sau khi thanh toán thành công (dùng cho IPN và xác nhận bank transfer)
const processSuccessfulPayment = async (transaction, session) => {
  const booking = await BookingOrder.findById(transaction.bookingId).session(
    session
  );
  if (!booking)
    throw new Error(
      `Booking ${transaction.bookingId} không tìm thấy cho giao dịch ${transaction._id}`
    );

  let newTotalPaid =
    (booking.paymentBreakdown.totalPaid || 0) + transaction.amount;
  newTotalPaid = Math.min(newTotalPaid, booking.amount); // Đảm bảo totalPaid không vượt quá totalAmount

  booking.paymentBreakdown.totalPaid = newTotalPaid;
  // booking.paymentBreakdown.remainingAmount sẽ được pre-save hook của BookingOrder tính lại, hoặc ta tự tính:
  booking.paymentBreakdown.remainingAmount = booking.amount - newTotalPaid;

  if (transaction.transaction_type === "deposit") {
    booking.paymentStatus = "deposit_paid";
  } else if (
    transaction.transaction_type === "full_payment" ||
    transaction.transaction_type === "final_payment"
  ) {
    if (booking.paymentBreakdown.remainingAmount <= 0) {
      booking.paymentStatus = "fully_paid";
    } else {
      // Nếu đã cọc, thì vẫn là deposit_paid (chưa trả hết final)
      booking.paymentStatus =
        booking.paymentStatus === "deposit_paid" ? "deposit_paid" : "unpaid";
    }
  }

  let bookingRoomsCreated = false;
  // Nếu booking đang 'pending_payment' và đã thanh toán (cọc hoặc đủ) thì xác nhận booking
  if (
    booking.status === "pending_payment" &&
    (booking.paymentStatus === "deposit_paid" ||
      booking.paymentStatus === "fully_paid")
  ) {
    booking.status = "confirmed";
    // booking.confirmedAt và booking.confirmationCode sẽ được Hook của BookingOrder xử lý khi status là 'confirmed'

    // Tạo BookingRoom entries từ consultationData.requestedRooms sau khi booking được confirmed
    const existingBookingRooms = await BookingRoom.find({
      bookingId: booking._id,
    }).session(session);
    if (
      existingBookingRooms.length === 0 &&
      booking.consultationData &&
      booking.consultationData.requestedRooms &&
      booking.consultationData.requestedRooms.length > 0
    ) {
      const bookingRoomPromises = booking.consultationData.requestedRooms.map(
        (roomData) => {
          const newBookingRoom = new BookingRoom({
            bookingId: booking._id,
            roomId: roomData.id, // Đây phải là ObjectId của Room thực tế
            quantity: roomData.quantity,
            price: roomData.price, // Tổng giá cho roomData này
          });
          return newBookingRoom.save({ session });
        }
      );
      await Promise.all(bookingRoomPromises);
      console.log(
        `BookingRooms đã được tạo cho BookingOrder ${booking._id} khi xác nhận.`
      );
      bookingRoomsCreated = true;
    }
  }
  await booking.save({ session });

  // Tạo Invoice
  const invoice = await createInvoiceForTransaction(transaction._id, session);

  return { booking, invoice, bookingRoomsCreated };
};
const createPaymentRequestHandler = async (req, res, paymentType) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId, paymentMethod } = req.body;

    const booking = await BookingOrder.findById(bookingId)
      .populate("customer")
      .session(session);

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Booking không tồn tại.",
      });
    }

    // Authorization check
    if (booking.customer._id.toString() !== req.user.customerId) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Không có quyền tạo thanh toán cho booking này.",
      });
    }

    // Status validation
    if (booking.status !== "pending_payment") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Booking không ở trạng thái chờ thanh toán. Trạng thái hiện tại: ${booking.status}`,
      });
    }

    // Calculate amount based on payment type
    let amountToPay;
    let transactionType;

    if (paymentType === "deposit") {
      if (
        booking.paymentStatus === "deposit_paid" ||
        booking.paymentStatus === "fully_paid"
      ) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Đã thanh toán cọc hoặc thanh toán đầy đủ rồi.",
        });
      }
      amountToPay =
        booking.paymentBreakdown?.depositAmount || booking.amount * 0.2;
      transactionType = "deposit";
    } else {
      // Full payment
      amountToPay = booking.paymentBreakdown?.remainingAmount || booking.amount;
      transactionType =
        booking.paymentBreakdown?.totalPaid > 0
          ? "final_payment"
          : "full_payment";
    }

    if (amountToPay <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Số tiền thanh toán không hợp lệ.",
      });
    }

    // Check for existing pending transaction
    const existingTransaction = await Transaction.findOne({
      bookingId: booking._id,
      status: "pending",
      transaction_type: transactionType,
    }).session(session);

    if (existingTransaction) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Đã có giao dịch đang chờ xử lý cho booking này.",
        data: {
          transactionId: existingTransaction._id,
          transactionReference: existingTransaction.transaction_reference,
        },
      });
    }

    // Create transaction
    const transaction = new Transaction({
      bookingId: booking._id,
      bookingCode: booking.bookingCode,
      amount: amountToPay,
      transaction_type: transactionType,
      status: "pending",
      payment_method: paymentMethod,
    });

    await transaction.save({ session });

    let paymentInitiationData = {
      transactionId: transaction._id.toString(),
      transactionReference: transaction.transaction_reference,
      amount: transaction.amount,
      paymentMethod: paymentMethod,
      bookingCode: booking.bookingCode,
      message: `Thanh toán ${transaction.amount.toLocaleString(
        "vi-VN"
      )} VNĐ cho đơn hàng ${booking.bookingCode}`,
    };

    // Handle different payment methods
    if (paymentMethod === "bank_transfer") {
      const bankInfo = {
        bankName: process.env.BANK_NAME || "Vietcombank",
        accountNumber: process.env.BANK_ACCOUNT_NUMBER || "1234567890",
        accountName: process.env.BANK_ACCOUNT_NAME || "YACHT BOOKING COMPANY",
        transferContent: `TT ${booking.bookingCode} ${transaction.transaction_reference}`,
      };

      transaction.gateway_response = { bank: bankInfo };
      await transaction.save({ session });

      paymentInitiationData.bankInfo = bankInfo;
      paymentInitiationData.expiredAt = transaction.expiredAt;
    } else if (paymentMethod === "vnpay") {
      const { paymentUrl } = await vnpayService.createPaymentUrl(
        transaction,
        booking,
        process.env.VNPAY_RETURN_URL,
        process.env.VNPAY_IPN_URL
      );
      paymentInitiationData.paymentUrl = paymentUrl;
      transaction.gateway_response.vnpay = { paymentUrl };
      await transaction.save({ session });
    } else if (paymentMethod === "momo") {
      const momoResult = await momoService.createPaymentRequest(
        transaction,
        booking,
        process.env.MOMO_RETURN_URL,
        process.env.MOMO_IPN_URL
      );
      paymentInitiationData.qrCodeUrl = momoResult.qrCodeUrl;
      paymentInitiationData.deeplink = momoResult.deeplink;
      transaction.gateway_response.momo = momoResult;
      await transaction.save({ session });
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      data: paymentInitiationData,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error(`Error creating ${paymentType} payment:`, error);
    res.status(500).json({
      success: false,
      message: `Lỗi server: ${error.message}`,
    });
  } finally {
    session.endSession();
  }
};
const createDepositPayment = (req, res) =>
  createPaymentRequestHandler(req, res, "deposit");
const createFullPayment = (req, res) =>
  createPaymentRequestHandler(req, res, "full");

const handleVnpayReturn = asyncHandler(async (req, res) => {
  const vnp_Params = req.query;
  console.log("VNPay Return Params:", vnp_Params);

  // TODO: Gọi vnpayService.verifySignature(vnp_Params, process.env.VNPAY_HASH_SECRET);
  const isValidSignature = true; // Giả sử hợp lệ để test

  if (!isValidSignature) {
    return res
      .status(400)
      .redirect(
        `${process.env.CLIENT_URL}/payment-status?status=error&message=invalid_signature&gateway=vnpay`
      );
  }

  const transactionRef = vnp_Params["vnp_TxnRef"]; // Mã giao dịch của bạn (transaction.transaction_reference)
  const responseCode = vnp_Params["vnp_ResponseCode"];

  // Không cập nhật DB ở return URL. Chỉ dùng để redirect KH.
  // Trạng thái cuối cùng sẽ được cập nhật bởi IPN.
  if (responseCode === "00") {
    // Có thể gọi QueryDR ở đây để lấy trạng thái chính xác hơn để hiển thị tạm cho KH.
    // const transactionStatusFromGateway = await vnpayService.queryTransactionStatus(transactionRef, vnp_Params['vnp_PayDate']);
    res.redirect(
      `${process.env.CLIENT_URL}/payment-status?status=success&orderRef=${transactionRef}&gateway=vnpay`
    );
  } else {
    res.redirect(
      `${
        process.env.CLIENT_URL
      }/payment-status?status=failure&orderRef=${transactionRef}&gateway=vnpay&reasonCode=${responseCode}&message=${
        vnp_Params["vnp_Message"] || "Thanh toán thất bại"
      }`
    );
  }
});

const handleVnpayIpn = asyncHandler(async (req, res) => {
  const vnp_Params = req.query; // VNPay IPN thường là GET
  console.log("VNPay IPN Params:", vnp_Params);

  // TODO: Gọi vnpayService.verifySignature(vnp_Params, process.env.VNPAY_HASH_SECRET);
  const isValidSignature = true; // Giả sử hợp lệ để test

  if (!isValidSignature) {
    console.error("VNPay IPN: Invalid signature", vnp_Params);
    // PHẢI trả về response theo tài liệu VNPay để họ không gửi lại IPN
    return res
      .status(200)
      .json({ RspCode: "97", Message: "Invalid Signature" });
  }

  const transactionRef = vnp_Params["vnp_TxnRef"];
  const vnpResponseCode = vnp_Params["vnp_ResponseCode"];
  const vnpTransactionNo = vnp_Params["vnp_TransactionNo"]; // Mã GD của VNPay
  const amountFromGateway = parseInt(vnp_Params["vnp_Amount"]) / 100; // VNPay gửi amount * 100

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const transaction = await Transaction.findOne({
      transaction_reference: transactionRef,
    }).session(session);

    if (!transaction) {
      console.error("VNPay IPN: Transaction not found", transactionRef);
      await session.abortTransaction();
      session.endSession();
      return res
        .status(200)
        .json({ RspCode: "01", Message: "Order not found" }); // Theo tài liệu VNPay
    }

    if (transaction.status === "completed") {
      console.log("VNPay IPN: Transaction already completed", transactionRef);
      await session.abortTransaction();
      session.endSession();
      return res
        .status(200)
        .json({ RspCode: "02", Message: "Order already confirmed" }); // Theo tài liệu VNPay
    }

    // Lưu lại thông tin từ IPN
    transaction.gateway_response.vnpay = {
      ...transaction.gateway_response.vnpay,
      ...vnp_Params,
      ipnReceivedAt: new Date(),
    };

    if (vnpResponseCode === "00") {
      // Giao dịch thành công
      if (transaction.amount !== amountFromGateway) {
        console.warn(
          `VNPay IPN: Amount mismatch for ${transactionRef}. DB: ${transaction.amount}, Gateway: ${amountFromGateway}`
        );
        transaction.status = "failed"; // Hoặc một trạng thái cần review
        transaction.failureReason = `Amount mismatch. Expected ${transaction.amount}, paid ${amountFromGateway}`;
      } else {
        transaction.status = "completed";
        transaction.completedAt = new Date();
        transaction.payment_gateway_id = vnpTransactionNo;
        await transaction.save({ session }); // Lưu transaction trước
        await processSuccessfulPayment(transaction, session); // Cập nhật Booking, tạo Invoice
        const invoice = await createInvoiceForTransaction(
          transaction._id,
          session
        );
      }
    } else {
      // Giao dịch thất bại
      transaction.status = "failed";
      transaction.failureReason = `VNPay IPN Response Code: ${vnpResponseCode} - ${
        vnp_Params["vnp_Message"] || "Unknown error"
      }`;
    }
    await transaction.save({ session }); // Lưu lại trạng thái cuối cùng của transaction

    await session.commitTransaction();
    session.endSession();

    // Phản hồi cho VNPay -> QUAN TRỌNG ĐỂ VNPay KHÔNG GỬI LẠI IPN
    if (
      transaction.status === "completed" &&
      transaction.amount === amountFromGateway
    ) {
      return res
        .status(200)
        .json({ RspCode: "00", Message: "Confirm Success" });
    } else if (
      transaction.status === "failed" &&
      transaction.amount !== amountFromGateway &&
      vnpResponseCode === "00"
    ) {
      // Trường hợp thành công từ gateway nhưng amount mismatch, bạn quyết định là lỗi
      return res.status(200).json({ RspCode: "04", Message: "Amount invalid" }); // Ví dụ
    } else {
      // Các trường hợp thất bại khác
      return res.status(200).json({
        RspCode: "99",
        Message: "Unknown error or failed transaction",
      }); // Hoặc mã lỗi cụ thể
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Lỗi xử lý VNPay IPN:", error);
    // Nếu có lỗi, cũng nên phản hồi cho VNPay để họ không retry mãi
    return res.status(200).json({ RspCode: "99", Message: "Server Error" });
  }
});

const handleMomoReturn = asyncHandler(async (req, res) => {
  const momoParams = req.query;
  console.log("MoMo Return Params:", momoParams);

  // TODO: Gọi momoService.verifySignature(momoParams, process.env.MOMO_SECRET_KEY, false); false vì là return URL
  const isValidSignature = true; // Giả sử

  if (!isValidSignature) {
    return res
      .status(400)
      .redirect(
        `${process.env.CLIENT_URL}/payment-status?status=error&message=invalid_signature&gateway=momo`
      );
  }

  const orderId = momoParams["orderId"]; // Mã đơn hàng của bạn (transaction.transaction_reference)
  const resultCode = momoParams["resultCode"];

  if (resultCode === "0") {
    res.redirect(
      `${process.env.CLIENT_URL}/payment-status?status=success&orderRef=${orderId}&gateway=momo`
    );
  } else {
    res.redirect(
      `${
        process.env.CLIENT_URL
      }/payment-status?status=failure&orderRef=${orderId}&gateway=momo&reasonCode=${resultCode}&message=${
        momoParams["message"] || "Thanh toán thất bại"
      }`
    );
  }
});

const handleMomoIpn = asyncHandler(async (req, res) => {
  const momoIpnPayload = req.body; // MoMo IPN là POST JSON
  console.log("MoMo IPN Payload:", momoIpnPayload);

  // TODO: Gọi momoService.verifySignature(momoIpnPayload, process.env.MOMO_SECRET_KEY, true); true vì là IPN
  const isValidSignature = true; // Giả sử

  if (!isValidSignature) {
    console.error("MoMo IPN: Invalid signature", momoIpnPayload);
    // MoMo thường chỉ cần HTTP 204 No Content nếu không có response body cụ thể khi lỗi signature
    // Hoặc trả về lỗi theo yêu cầu của họ nếu có.
    return res.status(400).send("Invalid Signature");
  }

  const orderId = momoIpnPayload.orderId; // transaction_reference của bạn
  const resultCode = momoIpnPayload.resultCode;
  const transId = momoIpnPayload.transId; // Mã GD của MoMo
  const amountFromGateway = parseInt(momoIpnPayload.amount);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const transaction = await Transaction.findOne({
      transaction_reference: orderId,
    }).session(session);
    if (!transaction) {
      console.error("MoMo IPN: Transaction not found", orderId);
      await session.abortTransaction();
      session.endSession();
      // Phản hồi cho MoMo (Cần xem tài liệu MoMo yêu cầu gì khi order không tìm thấy)
      // Ví dụ, có thể họ vẫn muốn 204 hoặc một mã lỗi cụ thể.
      return res.status(204).send(); // Hoặc res.status(400).json({errorCode: 1, message: "Order not found"}) - xem tài liệu MoMo
    }

    if (transaction.status === "completed") {
      console.log("MoMo IPN: Transaction already completed", orderId);
      await session.abortTransaction();
      session.endSession();
      // Phản hồi cho MoMo (Cần xem tài liệu MoMo yêu cầu gì khi đã confirm)
      // Ví dụ: res.status(200).json({partnerCode: ..., requestId: ..., orderId: ..., errorCode: 2, message:"Order already confirmed" })
      return res.status(204).send();
    }

    transaction.gateway_response.momo = {
      ...transaction.gateway_response.momo,
      ...momoIpnPayload,
      ipnReceivedAt: new Date(),
    };

    if (resultCode === 0) {
      // Thành công
      if (transaction.amount !== amountFromGateway) {
        console.warn(
          `MoMo IPN: Amount mismatch for ${orderId}. DB: ${transaction.amount}, Gateway: ${amountFromGateway}`
        );
        transaction.status = "failed";
        transaction.failureReason = `Amount mismatch. Expected ${transaction.amount}, paid ${amountFromGateway}`;
      } else {
        transaction.status = "completed";
        transaction.completedAt = new Date();
        transaction.payment_gateway_id = transId;
        await transaction.save({ session });
        await processSuccessfulPayment(transaction, session);
        const invoice = await createInvoiceForTransaction(
          transaction._id,
          session
        );
      }
    } else {
      // Thất bại
      transaction.status = "failed";
      transaction.failureReason = `MoMo IPN Result Code: ${resultCode} - ${
        momoIpnPayload.message || "Unknown error"
      }`;
    }
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Phản hồi cho MoMo (Rất quan trọng)
    // MoMo thường yêu cầu bạn trả về một JSON object cụ thể để xác nhận đã nhận IPN.
    // Ví dụ (Cần kiểm tra tài liệu MoMo để có Payload chính xác):
    // const responseToMoMo = {
    //   partnerCode: process.env.MOMO_PARTNER_CODE,
    //   requestId: momoIpnPayload.requestId,
    //   orderId: momoIpnPayload.orderId,
    //   resultCode: 0, // 0 nếu bạn xử lý thành công (ngay cả khi GD gốc thất bại)
    //   message: "Successfully received IPN",
    //   responseTime: Date.now(),
    // };
    // return res.status(200).json(responseToMoMo);
    // Hoặc đơn giản là 204 nếu MoMo chỉ cần biết bạn đã nhận:
    return res.status(204).send();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Lỗi xử lý MoMo IPN:", error);
    // Phản hồi lỗi cho MoMo nếu có thể
    // Ví dụ: return res.status(500).json({message: "Server error processing IPN"});
    return res.status(204).send(); // Hoặc chỉ cần 204
  }
});

// Simulate payment success (for testing)
const simulatePaymentSuccess = asyncHandler(async (req, res, next) => {
  const { transactionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    return res
      .status(400)
      .json({ success: false, message: "Transaction ID không hợp lệ." });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const transaction = await Transaction.findById(transactionId).session(
      session
    );
    if (!transaction) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Transaction không tìm thấy." });
    }
    if (transaction.status === "completed") {
      await session.abortTransaction();
      return res.json({
        success: true,
        message: "Transaction đã ở trạng thái completed.",
      });
    }
    // Cập nhật trạng thái transaction
    transaction.status = "completed";
    transaction.completedAt = new Date();
    // Đảm bảo các trường gateway_response con luôn là object
    if (!transaction.gateway_response) {
      transaction.gateway_response = { vnpay: {}, momo: {}, bank: {} };
    } else {
      if (!transaction.gateway_response.vnpay)
        transaction.gateway_response.vnpay = {};
      if (!transaction.gateway_response.momo)
        transaction.gateway_response.momo = {};
      if (!transaction.gateway_response.bank)
        transaction.gateway_response.bank = {};
    }
    // Gán thông tin mô phỏng vào bank
    transaction.gateway_response.bank = {
      bankName: "Simulated Bank",
      accountNumber: "0000000000",
      accountName: "Simulated Account",
      transferContent: "Simulated Content",
    };
    transaction.gateway_response.simulated_at = new Date().toISOString();
    transaction.gateway_response.message = "Simulated success by admin/test";
    transaction.gateway_response.vnp_TransactionNo = `SIM${Date.now()}`;
    await transaction.save({ session });
    await processSuccessfulPayment(transaction, session);

    await createInvoiceForTransaction(transaction._id, session);
    await session.commitTransaction();
    session.endSession();
    res.json({
      success: true,
      message: `Đã mô phỏng thanh toán thành công cho transaction ${transactionId} và tạo invoice nếu đủ điều kiện.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Lỗi giả lập thanh toán:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi giả lập thanh toán.",
      error: error.message,
    });
  }
});

const getTransactionStatusForCustomer = asyncHandler(async (req, res) => {
  const { transactionIdOrRef } = req.params;
  if (!req.user.customerId) {
    return res
      .status(401)
      .json({ success: false, message: "Yêu cầu xác thực." });
  }

  let transaction;
  if (mongoose.Types.ObjectId.isValid(transactionIdOrRef)) {
    transaction = await Transaction.findById(transactionIdOrRef).populate({
      path: "bookingId",
      select: "customer", // Chỉ cần customer để check quyền
    });
  } else {
    transaction = await Transaction.findOne({
      transaction_reference: transactionIdOrRef,
    }).populate({
      path: "bookingId",
      select: "customer",
    });
  }

  if (!transaction) {
    return res
      .status(404)
      .json({ success: false, message: "Giao dịch không tồn tại." });
  }

  // Authorization
  if (
    !transaction.bookingId ||
    transaction.bookingId.customer.toString() !== req.user.customerId
  ) {
    return res
      .status(403)
      .json({ success: false, message: "Không có quyền xem giao dịch này." });
  }
  const publicTransactionData = {
    _id: transaction._id,
    transaction_reference: transaction.transaction_reference,
    bookingCode: transaction.bookingCode,
    amount: transaction.amount,
    transaction_type: transaction.transaction_type,
    status: transaction.status,
    payment_method: transaction.payment_method,
    transactionDate: transaction.transactionDate,
    completedAt: transaction.completedAt,
    expiredAt: transaction.expiredAt,
    failureReason: transaction.failureReason,
    bankInfo:
      transaction.payment_method === "bank_transfer" &&
      transaction.status === "pending"
        ? transaction.gateway_response.bank
        : undefined,
  };

  res.status(200).json({
    success: true,
    data: publicTransactionData,
  });
});

const cancelTransaction = async (req, res) => {
  const { transactionId } = req.params;
  try {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }
    if (transaction.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending transactions can be cancelled",
      });
    }
    transaction.status = "cancelled";
    await transaction.save();
    return res.json({
      success: true,
      message: "Transaction cancelled successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createDepositPayment,
  createFullPayment,
  handleVnpayReturn,
  handleVnpayIpn,
  handleMomoReturn,
  handleMomoIpn,
  simulatePaymentSuccess,
  getTransactionStatus: getTransactionStatusForCustomer,
  cancelTransaction: cancelTransaction,
};
