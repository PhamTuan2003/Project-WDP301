const { BookingOrder, BookingRoom, Invoice, Transaction, Customer, Yacht } = require("../model");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const { sendBookingConfirmationEmail } = require("../utils/sendMail");

const parseGuestCount = (guestCountValue) => {
  if (typeof guestCountValue === "number") {
    return guestCountValue;
  }
  if (typeof guestCountValue === "string") {
    const numbers = guestCountValue.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      return numbers.reduce((sum, num) => sum + parseInt(num), 0);
    }
  }
  return 1;
};

// ==================== BOOKING ROOM FUNCTIONS ====================
exports.createBookingOrConsultationRequest = asyncHandler(async (req, res) => {
  console.log("Starting createBookingOrConsultationRequest with body:", req.body);

  const {
    yachtId,
    bookingId,
    scheduleId,
    checkInDate,
    guestCount,
    selectedRooms,
    totalPrice,
    requirements,
    fullName,
    phoneNumber,
    email,
    address,
    requestType = "consultation_requested",
  } = req.body;

  console.log("Parsed request parameters:", {
    yachtId,
    scheduleId,
    checkInDate,
    guestCount,
    totalPrice,
    requestType,
  });

  const requiredFields = {
    yachtId,
    checkInDate,
    guestCount,
    fullName,
    phoneNumber,
    email,
  };
  const missingFields = Object.entries(requiredFields)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  console.log("Validation check - Missing fields:", missingFields);

  if (missingFields.length > 0) {
    console.log("Validation failed - Missing required fields");
    return res.status(400).json({
      success: false,
      message: `Thiếu thông tin bắt buộc: ${missingFields.join(", ")}`,
      missingFields,
    });
  }

  const validRequestTypes = ["pending_payment", "consultation_requested"];
  console.log("Validating request type:", requestType);

  if (!validRequestTypes.includes(requestType)) {
    console.log("Invalid request type:", requestType);
    return res.status(400).json({
      success: false,
      message: "Loại yêu cầu không hợp lệ.",
    });
  }

  console.log("Checking total price for direct booking:", {
    requestType,
    totalPrice,
  });

  if (requestType === "pending_payment" && (totalPrice === undefined || totalPrice <= 0)) {
    console.log("Invalid total price for direct booking");
    return res.status(400).json({
      success: false,
      message: "Tổng giá là bắt buộc và phải lớn hơn 0 cho yêu cầu đặt trực tiếp.",
    });
  }

  console.log("Validating selected rooms:", {
    hasRooms: !!selectedRooms,
    isArray: Array.isArray(selectedRooms),
    length: selectedRooms?.length,
  });

  if (!selectedRooms || !Array.isArray(selectedRooms) || selectedRooms.length === 0) {
    console.log("Invalid room selection");
    return res.status(400).json({
      success: false,
      message: "Vui lòng chọn ít nhất một phòng.",
    });
  }

  const checkIn = new Date(checkInDate);
  console.log("Validating check-in date:", {
    checkInDate,
    parsedDate: checkIn,
    isValid: !isNaN(checkIn.getTime()),
    isFuture: checkIn > new Date(),
  });

  if (isNaN(checkIn.getTime()) || checkIn < new Date()) {
    console.log("Invalid check-in date");
    return res.status(400).json({
      success: false,
      message: "Ngày check-in không hợp lệ hoặc đã qua.",
    });
  }

  if (!req.user.customerId) {
    console.log("No customer ID found in token");
    return res.status(401).json({
      success: false,
      message: "Không tìm thấy thông tin khách hàng từ token.",
    });
  }

  console.log("Starting database transaction");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("Finding customer with ID:", req.user.customerId);
    const customer = await Customer.findById(req.user.customerId).session(session);
    if (!customer) {
      console.log("Customer not found");
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin khách hàng.",
      });
    }

    // Update customer info if provided
    console.log("Checking for customer info updates");
    const customerUpdates = {};
    if (fullName && customer.fullName !== fullName) customerUpdates.fullName = fullName;
    if (phoneNumber && customer.phoneNumber !== phoneNumber) customerUpdates.phoneNumber = phoneNumber;
    if (email && customer.email !== email) customerUpdates.email = email;
    if (address && customer.address !== address) customerUpdates.address = address;

    console.log("Customer updates to apply:", customerUpdates);

    if (Object.keys(customerUpdates).length > 0) {
      Object.assign(customer, customerUpdates);
      await customer.save({ session });
      console.log("Customer info updated successfully");
    }

    const totalGuestCount = parseGuestCount(guestCount);
    console.log("Parsed total guest count:", totalGuestCount);

    // Validate room data
    console.log("Processing selected rooms data");
    const processedRooms = selectedRooms.map((room, index) => {
      console.log(`Processing room ${index + 1}:`, room);
      if (!room.id || !room.name || !room.quantity || !room.price) {
        throw new Error(`Thông tin phòng thứ ${index + 1} không đầy đủ`);
      }
      if (room.quantity <= 0 || room.price <= 0) {
        throw new Error(`Số lượng và giá phòng phải lớn hơn 0`);
      }
      return {
        id: room.id,
        name: room.name,
        description: room.description || "",
        area: room.area || 0,
        avatar: room.avatar || "",
        max_people: room.max_people || 1,
        price: room.price,
        quantity: room.quantity,
        beds: room.beds || 1,
        image: room.image || room.avatar || "",
      };
    });

    console.log("Creating new booking order data");
    const newBookingOrderData = {
      customer: customer._id,
      customerInfo: {
        fullName: customer.fullName,
        email: customer.email,
        phoneNumber: customer.phoneNumber,
        address: customer.address || null,
      },
      yacht: yachtId,
      schedule: scheduleId || null,
      amount: totalPrice || 0,
      status: requestType,
      consultationStatus: requestType === "consultation_requested" ? "requested" : "not_requested",
      requirements: requirements || "",
      guestCount: totalGuestCount,
      adults: req.body.adults ?? 1,
      childrenUnder10: req.body.childrenUnder10 ?? 0,
      childrenAbove10: req.body.childrenAbove10 ?? 0,
      checkInDate: checkIn,
      consultationData: {
        requestedRooms: processedRooms,
        estimatedPrice: totalPrice || 0,
        status: requestType === "consultation_requested" ? "pending" : "completed",
        createdAt: new Date(),
      },
      confirmationCode: uuidv4().replace(/-/g, ""),
    };

    console.log("Saving new booking order");
    const newBookingOrder = new BookingOrder(newBookingOrderData);
    const savedBookingOrder = await newBookingOrder.save({ session });
    console.log("Booking order saved successfully:", savedBookingOrder._id);

    if (requestType === "pending_payment") {
      // Xóa các BookingRoom cũ nếu có (phòng tránh trùng khi update)
      await BookingRoom.deleteMany({ bookingId: savedBookingOrder._id }, { session });
      for (const room of processedRooms) {
        await BookingRoom.create(
          [
            {
              bookingId: savedBookingOrder._id,
              roomId: room.id,
              quantity: room.quantity,
              price: room.price,
            },
          ],
          { session }
        );
      }
    }

    // Gửi email xác nhận theo loại booking
    try {
      const checkInDateStr = new Date(savedBookingOrder.checkInDate).toLocaleDateString("vi-VN");
      if (requestType === "consultation_requested") {
        const { sendConsultationEmail } = require("../utils/sendMail");
        await sendConsultationEmail(
          email,
          fullName,
          savedBookingOrder.bookingCode,
          checkInDateStr,
          savedBookingOrder.guestCount,
          requirements
        );
      } else if (requestType === "pending_payment") {
        const { sendBookingConfirmationEmail } = require("../utils/sendMail");
        await sendBookingConfirmationEmail(
          email,
          fullName,
          savedBookingOrder.bookingCode,
          checkInDateStr,
          savedBookingOrder.guestCount,
          savedBookingOrder.amount?.toLocaleString("vi-VN")
        );
      }
    } catch (mailErr) {
      console.error("Lỗi gửi email:", mailErr.message);
      // Không throw lỗi này để không ảnh hưởng tới booking, chỉ log lại
    }

    await session.commitTransaction();
    console.log("Transaction committed successfully");

    res.status(201).json({
      success: true,
      message:
        requestType === "pending_payment"
          ? "Yêu cầu đặt chỗ đã được tạo. Vui lòng tiến hành thanh toán."
          : "Yêu cầu tư vấn của bạn đã được gửi thành công.",
      data: {
        bookingId: savedBookingOrder.bookingId || savedBookingOrder._id,
        bookingCode: savedBookingOrder.bookingCode,
        confirmationCode: savedBookingOrder.confirmationCode,
        status: savedBookingOrder.status,
        consultationStatus: savedBookingOrder.consultationStatus,
        amount: savedBookingOrder.amount,
        paymentBreakdown: savedBookingOrder.paymentBreakdown,
      },
    });
  } catch (error) {
    console.error("Error in createBookingOrConsultationRequest:", error);
    await session.abortTransaction();
    console.error("Lỗi tạo booking/consultation request:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xử lý yêu cầu.",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  } finally {
    console.log("Ending database session");
    session.endSession();
  }
});

// DEPRECATED: This function is redundant. The logic is now handled by createBookingOrConsultationRequest.
// exports.createConsultation = ... (function removed)

// In bookingController.js
exports.getConsultationRequest = asyncHandler(async (req, res) => {
  const { yachtId } = req.query;
  const customerId = req.user.customerId;

  if (!customerId || !yachtId) {
    return res.status(400).json({
      success: false,
      message: "Thiếu customerId hoặc yachtId.",
    });
  }

  const consultation = await BookingOrder.findOne({
    customer: customerId,
    yacht: yachtId,
    status: "consultation_requested",
  }).lean();

  if (!consultation) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy yêu cầu tư vấn.",
    });
  }

  res.status(200).json({
    success: true,
    data: {
      bookingId: consultation._id.toString(),
      bookingCode: consultation.bookingCode,
      confirmationCode: consultation.confirmationCode,
      fullName: consultation.customerInfo.fullName,
      email: consultation.customerInfo.email,
      phoneNumber: consultation.customerInfo.phoneNumber,
      address: consultation.customerInfo.address || "",
      checkInDate: consultation.checkInDate,
      guestCount: consultation.guestCount,
      adults: consultation.adults ?? 1,
      childrenUnder10: consultation.childrenUnder10 ?? 0,
      childrenAbove10: consultation.childrenAbove10 ?? 0,
      requirements: consultation.requirements,
      selectedRooms: consultation.consultationData.requestedRooms,
      totalPrice: consultation.consultationData.estimatedPrice,
      yachtId: consultation.yacht,
      scheduleId: consultation.schedule || null,
    },
  });
});

/**
 * @desc    Customer confirms a booking after receiving consultation/quote from staff
 * @route   POST /api/v1/bookings/:bookingId/confirm-consultation
 * @access  Private (Customer)
 */
exports.customerConfirmBookingAfterConsultation = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return res.status(400).json({ success: false, message: "Booking ID không hợp lệ." });
  }
  if (!req.user.customerId) {
    return res.status(401).json({
      success: false,
      message: "Không tìm thấy thông tin khách hàng từ token.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await BookingOrder.findById(bookingId).session(session);

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Booking không tồn tại." });
    }

    // Authorization: Customer chỉ có thể confirm booking của chính mình
    if (booking.customer.toString() !== req.user.customerId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "Không có quyền xác nhận booking này.",
      });
    }

    // Chỉ cho phép xác nhận nếu booking ở trạng thái đã gửi tư vấn
    if (
      booking.consultationStatus !== "sent" ||
      booking.status === "pending_payment" ||
      booking.status === "confirmed"
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Booking không ở trạng thái cho phép xác nhận hoặc đã được xử lý.",
      });
    }
    // Nhân viên đã phải cập nhật `booking.amount` và `booking.consultationData.requestedRooms` với thông tin cuối cùng.

    booking.status = "pending_payment"; // Chuyển sang chờ thanh toán
    booking.consultationStatus = "responded"; // KH đã phản hồi
    // booking.paymentPendingAt = new Date(); // pre-save hook sẽ set

    const savedBooking = await booking.save({ session });

    // Lấy thông tin du thuyền và gửi email xác nhận đặt phòng
    try {
      const populatedBooking = await BookingOrder.findById(savedBooking._id).populate("yacht", "name").lean();
      const yachtName = populatedBooking.yacht?.name || "(Không rõ)";
      const checkInDateStr = new Date(populatedBooking.checkInDate).toLocaleDateString("vi-VN");
      // Lấy danh sách phòng đã chọn
      const rooms = (populatedBooking.consultationData?.requestedRooms || [])
        .map(
          (room) =>
            `<li>${room.name} x ${room.quantity} (${room.area || "?"}m²) - ${room.price?.toLocaleString(
              "vi-VN"
            )} VNĐ</li>`
        )
        .join("");
      const roomListHtml = rooms ? `<ul>${rooms}</ul>` : "Không có";
      const requirements = populatedBooking.requirements || "Không có";
      const { sendBookingConfirmationEmail } = require("../utils/sendMail");
      await sendBookingConfirmationEmail(
        populatedBooking.customerInfo?.email || "",
        populatedBooking.customerInfo?.fullName || "",
        populatedBooking.bookingCode,
        checkInDateStr,
        populatedBooking.guestCount,
        populatedBooking.amount?.toLocaleString("vi-VN"),
        {
          yachtName,
          roomListHtml,
          requirements,
        }
      );
    } catch (mailErr) {
      console.error("Lỗi gửi email xác nhận đặt phòng sau tư vấn:", mailErr.message);
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Xác nhận booking thành công. Vui lòng tiến hành thanh toán.",
      data: {
        bookingId: savedBooking._id.toString(),
        bookingCode: savedBooking.bookingCode,
        status: savedBooking.status,
        amountToPay: savedBooking.amount,
        paymentBreakdown: savedBooking.paymentBreakdown,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Lỗi customer confirm booking after consultation:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xác nhận booking.",
      error: error.message,
    });
  }
});
// ==================== BOOKING STATUS MANAGEMENT ====================

exports.updateBookingStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, scheduleId } = req.body; // scheduleId might be needed if confirming

  const validStatuses = [
    "consultation_requested",
    "consultation_sent", // Added from BookingOrder schema
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
    const booking = await BookingOrder.findById(id).session(session);

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Booking không tồn tại",
      });
    }

    // Authorization check: (Example - adapt if admin/staff roles exist)
    // For customer updates, ensure they own the booking
    // For admin updates, check role
    if (req.user.role !== "admin") {
      // Assuming a role system
      const customer = await Customer.findOne({
        accountId: req.user._id,
      }).session(session);
      if (!customer || booking.customer.toString() !== customer._id.toString()) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({
          success: false,
          message: "Không có quyền cập nhật booking này",
        });
      }
    }

    const oldStatus = booking.status;
    booking.status = status;

    if (status === "confirmed") {
      if (scheduleId) booking.schedule = scheduleId; // Update schedule if provided
      // The pre-save hook in BookingOrder will set confirmationCode and confirmedAt.

      // Create BookingRoom entries if moving to "confirmed" and they don't exist
      const existingBookingRooms = await BookingRoom.find({
        bookingId: booking._id,
      }).session(session);
      if (
        existingBookingRooms.length === 0 &&
        booking.consultationData &&
        booking.consultationData.requestedRooms &&
        booking.consultationData.requestedRooms.length > 0
      ) {
        const bookingRoomPromises = booking.consultationData.requestedRooms.map((roomData) => {
          const newBookingRoom = new BookingRoom({
            bookingId: booking._id,
            roomId: roomData.id, // This is the ObjectId of the actual Room
            quantity: roomData.quantity,
            price: roomData.price, // This is the total price for this room selection (price for quantity)
          });
          return newBookingRoom.save({ session });
        });
        await Promise.all(bookingRoomPromises);
        console.log(`BookingRooms created for BookingOrder ${booking._id}`);
      }
    }
    // pre-save hook handles other status-related timestamps (cancelledAt, etc.)

    const updatedBooking = await booking.save({ session });
    await updatedBooking.populate([
      { path: "customer", select: "fullName phoneNumber email" },
      // Add other populates if needed for the response
    ]);

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      data: updatedBooking,
      message: `Booking status đã được cập nhật thành ${status}.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Lỗi cập nhật status booking:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật status booking.",
      error: error.message,
    });
  }
});

exports.confirmBooking = asyncHandler(async (req, res) => {
  const { id } = req.params; // BookingOrder ID
  const { scheduleId } = req.body;

  console.log("Received confirm request for BookingOrder ID:", id, "with scheduleId:", scheduleId);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Thiếu Booking ID",
    });
  }
  // scheduleId might be optional if already set or not applicable for this confirmation type

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await BookingOrder.findById(id).session(session);
    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy booking với ID: ${id}`,
      });
    }

    console.log("Current booking state before confirmation:", booking.status, booking.consultationData);

    if (booking.status === "confirmed") {
      await session.abortTransaction(); // No need to re-confirm
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Booking này đã được xác nhận trước đó.",
      });
    }

    // Typically, confirmation moves from 'consultation_requested' or 'consultation_sent'
    if (!["consultation_requested", "consultation_sent"].includes(booking.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Booking không ở trạng thái cho phép xác nhận (hiện tại: ${booking.status})`,
      });
    }

    booking.status = "confirmed";
    if (scheduleId) {
      booking.schedule = scheduleId;
    }
    // booking.confirmedAt and booking.confirmationCode will be set by pre-save hook in BookingOrder model

    // Create BookingRoom entries from consultationData.requestedRooms
    const existingBookingRooms = await BookingRoom.find({
      bookingId: booking._id,
    }).session(session);
    if (
      existingBookingRooms.length === 0 &&
      booking.consultationData &&
      booking.consultationData.requestedRooms &&
      booking.consultationData.requestedRooms.length > 0
    ) {
      const bookingRoomPromises = booking.consultationData.requestedRooms.map((roomData) => {
        const newBookingRoom = new BookingRoom({
          bookingId: booking._id,
          roomId: roomData.id, // This is the ObjectId of the actual Room
          quantity: roomData.quantity,
          price: roomData.price, // This is the total price for this roomData (price for quantity)
        });
        return newBookingRoom.save({ session });
      });
      await Promise.all(bookingRoomPromises);
      console.log(`BookingRooms created for BookingOrder ${booking._id} upon confirmation.`);
    } else if (existingBookingRooms.length === 0) {
      console.warn(
        `BookingOrder ${booking._id} confirmed, but no requestedRooms found in consultationData or BookingRooms already exist.`
      );
    }

    const updatedBooking = await booking.save({ session });
    await session.commitTransaction();
    session.endSession();

    console.log("Updated booking after confirmation:", updatedBooking);

    res.status(200).json({
      success: true,
      message: "Booking đã được xác nhận!",
      data: {
        id: updatedBooking._id.toString(),
        bookingCode: updatedBooking.bookingCode,
        confirmationCode: updatedBooking.confirmationCode,
        status: updatedBooking.status,
        schedule: updatedBooking.schedule,
        // Include other relevant details
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Lỗi xác nhận booking:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xác nhận booking",
      error: error.message,
    });
  }
});

exports.rejectBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await BookingOrder.findById(id).session(session);

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Booking không tồn tại",
      });
    }

    // Authorization (customer or admin)
    // This is a simplified check, adapt to your auth logic
    let canCancel = false;
    if (req.user.role === "admin") {
      // Assuming admin role
      canCancel = true;
    } else {
      const customer = await Customer.findOne({
        accountId: req.user._id,
      }).session(session);
      if (customer && booking.customer.toString() === customer._id.toString()) {
        canCancel = true;
      }
    }

    if (!canCancel) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "Không có quyền hủy/từ chối booking này",
      });
    }

    if (booking.status === "cancelled" || booking.status === "rejected") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Booking này đã được hủy hoặc từ chối trước đó.",
      });
    }

    // Use "cancelled" for customer-initiated, "rejected" for staff-initiated
    // For simplicity, this function handles both as a general "rejection/cancellation"
    // You might want separate functions or pass a reason.
    booking.status = "cancelled"; // Or "rejected" depending on who is acting
    // booking.cancelledAt will be set by pre-save hook

    const updatedBooking = await booking.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      data: updatedBooking,
      message: "Booking đã được hủy/từ chối.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Lỗi hủy/từ chối booking:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi hủy/từ chối booking.",
      error: error.message,
    });
  }
});
// NEW: Controller to UPDATE an existing request
exports.updateBookingOrConsultationRequest = asyncHandler(async (req, res) => {
  // LOG giá trị nhận được từ FE
  console.log("[updateBookingOrConsultationRequest] Nhận từ FE:", {
    checkInDate: req.body.checkInDate,
    guestCount: req.body.guestCount,
    bookingId: req.params.bookingId,
    fullBody: req.body,
  });
  const { bookingId } = req.params;
  const {
    yachtId,
    scheduleId,
    checkInDate,
    guestCount,
    selectedRooms,
    totalPrice,
    requirements,
    fullName,
    phoneNumber,
    email,
    address,
    requestType, // 'consultation_requested' or 'pending_payment'
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return res.status(400).json({ success: false, message: "Booking ID không hợp lệ." });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bookingOrder = await BookingOrder.findById(bookingId).session(session);

    if (!bookingOrder) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu booking." });
    }

    // Authorization: Ensure the user owns this booking
    if (bookingOrder.customer.toString() !== req.user.customerId) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền chỉnh sửa yêu cầu này.",
      });
    }

    // State validation: Only allow edits on 'consultation_requested' status
    if (bookingOrder.status !== "consultation_requested") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Không thể chỉnh sửa yêu cầu ở trạng thái "${bookingOrder.status}".`,
      });
    }

    // Update customer info if it has changed
    const customerUpdates = {};
    if (fullName && bookingOrder.customerInfo.fullName !== fullName)
      customerUpdates["customerInfo.fullName"] = fullName;
    if (phoneNumber && bookingOrder.customerInfo.phoneNumber !== phoneNumber)
      customerUpdates["customerInfo.phoneNumber"] = phoneNumber;
    if (email && bookingOrder.customerInfo.email !== email) customerUpdates["customerInfo.email"] = email;
    if (address && bookingOrder.customerInfo.address !== address) customerUpdates["customerInfo.address"] = address;

    // Update booking details
    bookingOrder.yacht = yachtId;
    bookingOrder.schedule = scheduleId || null;
    bookingOrder.checkInDate = new Date(checkInDate);
    bookingOrder.guestCount = parseInt(guestCount, 10) || 1;
    // Thêm cập nhật childrenUnder10 và childrenAbove10
    if (typeof req.body.childrenUnder10 !== "undefined") {
      bookingOrder.childrenUnder10 = req.body.childrenUnder10;
    }
    if (typeof req.body.childrenAbove10 !== "undefined") {
      bookingOrder.childrenAbove10 = req.body.childrenAbove10;
    }
    bookingOrder.requirements = requirements || "";
    bookingOrder.amount = totalPrice || 0;

    // Thêm cập nhật adults
    if (typeof req.body.adults !== "undefined") {
      bookingOrder.adults = req.body.adults;
    }

    // This is the important part: update status based on user's final action
    bookingOrder.status = requestType;

    // Update consultation data with the new selection
    bookingOrder.consultationData.requestedRooms = selectedRooms.map((room) => ({
      id: room.id,
      name: room.name,
      quantity: room.quantity,
      price: room.price,
      description: room.description,
      area: room.area,
      avatar: room.avatar,
      max_people: room.max_people,
      beds: room.beds,
      image: room.image,
    }));
    bookingOrder.consultationData.estimatedPrice = totalPrice || 0;
    bookingOrder.consultationData.updatedAt = new Date();

    // Apply customer info updates if any
    if (Object.keys(customerUpdates).length > 0) {
      Object.assign(bookingOrder, customerUpdates);
    }

    const savedBookingOrder = await bookingOrder.save({ session });
    // LOG giá trị sau khi lưu vào DB
    console.log("[updateBookingOrConsultationRequest] Sau khi save vào DB:", {
      checkInDate: savedBookingOrder.checkInDate,
      guestCount: savedBookingOrder.guestCount,
      bookingId: savedBookingOrder._id,
      status: savedBookingOrder.status,
    });
    // Nếu chuyển sang pending_payment, tạo lại BookingRoom
    if (requestType === "pending_payment") {
      await BookingRoom.deleteMany({ bookingId: savedBookingOrder._id }, { session });
      for (const room of selectedRooms) {
        await BookingRoom.create(
          [
            {
              bookingId: savedBookingOrder._id,
              roomId: room.id,
              quantity: room.quantity,
              price: room.price,
            },
          ],
          { session }
        );
      }
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message:
        requestType === "pending_payment"
          ? "Yêu cầu đã được cập nhật. Vui lòng thanh toán."
          : "Yêu cầu tư vấn đã được cập nhật.",
      data: {
        bookingId: savedBookingOrder._id.toString(),
        bookingCode: savedBookingOrder.bookingCode,
        status: savedBookingOrder.status,
        childrenAbove10: savedBookingOrder.childrenAbove10,
        childrenUnder10: savedBookingOrder.childrenUnder10,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Lỗi cập nhật booking/consultation request:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xử lý yêu cầu.",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
});

// NEW: Controller to DELETE a consultation request
exports.cancelConsultationRequest = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return res.status(400).json({ success: false, message: "Booking ID không hợp lệ." });
  }

  const bookingOrder = await BookingOrder.findOne({
    _id: bookingId,
    customer: req.user.customerId, // Ensure ownership
  });

  if (!bookingOrder) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy yêu cầu tư vấn hoặc bạn không có quyền.",
    });
  }

  // Only allow deletion if it's still just a request
  if (bookingOrder.status !== "consultation_requested") {
    return res.status(400).json({
      success: false,
      message: "Không thể hủy yêu cầu đã được xử lý.",
    });
  }

  await bookingOrder.deleteOne();

  res.status(200).json({
    success: true,
    message: "Yêu cầu tư vấn đã được hủy thành công.",
  });
});

// ==================== BOOKING RETRIEVAL FUNCTIONS ====================

exports.getBookingWithTransactions = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await BookingOrder.findById(id)
      .populate("customer", "fullName phoneNumber email address") // Added address
      .populate("yacht", "name images location")
      .populate("schedule", "startDate endDate");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking không tồn tại",
      });
    }

    // Authorization
    let canAccess = false;
    if (req.user.role === "admin") {
      canAccess = true;
    } else {
      const customer = await Customer.findOne({ accountId: req.user._id });
      if (customer && booking.customer._id.toString() === customer._id.toString()) {
        canAccess = true;
      }
    }
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền truy cập booking này",
      });
    }

    const transactions = await Transaction.find({ bookingId: id }).sort({
      createdAt: -1,
    });
    const bookedRooms = await BookingRoom.find({ bookingId: id }).populate(
      "roomId",
      "name price area description images"
    ); // Populate more room details
    const invoices = await Invoice.find({ bookingId: id }).sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      data: {
        booking,
        transactions,
        bookedRooms,
        invoices, // Replaced 'bill' with 'invoices' as it's an array
      },
    });
  } catch (error) {
    console.error("Lỗi lấy booking với transactions:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy booking.",
      error: error.message,
    });
  }
});

/**
 * @desc    Get all bookings for the logged-in customer
 * @route   GET /api/v1/bookings/my-bookings
 * @access  Private (Customer)
 */
exports.getCustomerBookings = asyncHandler(async (req, res) => {
  if (!req.user.customerId) {
    return res.status(401).json({
      success: false,
      message: "Không tìm thấy thông tin khách hàng từ token.",
    });
  }

  const bookings = await BookingOrder.find({ customer: req.user.customerId })
    .populate("yacht", "name images location")
    .populate("schedule", "startDate endDate")
    .sort({ createdAt: -1 }); // Sắp xếp theo ngày tạo mới nhất

  res.status(200).json({
    success: true,
    count: bookings.length,
    data: bookings,
  });
});

/**
 * @desc    Get a single booking detail for the logged-in customer
 * @route   GET /api/v1/bookings/:bookingId/my-detail
 * @access  Private (Customer)
 */
exports.getCustomerBookingDetail = asyncHandler(async (req, res) => {
  if (!req.user.customerId) {
    return res.status(401).json({
      success: false,
      message: "Không tìm thấy thông tin khách hàng từ token.",
    });
  }
  const { bookingId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(req.params.bookingId)) {
    return res.status(400).json({ success: false, message: "Booking ID không hợp lệ." });
  }

  const booking = await BookingOrder.findById(bookingId)
    .populate("yacht", "name images location")
    .populate("schedule", "startDate endDate")
    .populate({ path: "customer", select: "fullName email phoneNumber" });

  if (!booking) {
    return res.status(404).json({ success: false, message: "Booking không tồn tại." });
  }

  // Authorization: Customer chỉ xem được booking của mình
  if (booking.customer._id.toString() !== req.user.customerId) {
    return res.status(403).json({
      success: false,
      message: "Không có quyền xem chi tiết booking này.",
    });
  }

  // (Tùy chọn) Lấy thêm thông tin phòng đã đặt, giao dịch, hóa đơn
  const bookedRooms = await BookingRoom.find({
    bookingId: booking._id,
  }).populate("roomId", "name price"); // Giả sử 'roomId' là ref đến model Room

  // const transactions = await Transaction.find({ bookingId: booking._id }); // Sẽ được lấy từ P.Controller

  res.status(200).json({
    success: true,
    data: {
      booking: {
        ...booking.toObject(),
        adults: booking.adults,
        childrenUnder10: booking.childrenUnder10,
        childrenAbove10: booking.childrenAbove10,
      },
      bookedRooms,
      // transactions, // Frontend nên gọi API riêng để lấy transactions.
    },
  });
});

// ==================== UTILITY FUNCTIONS ====================
exports.getRooms = asyncHandler(async (req, res) => {
  const { yachtId, scheduleId, checkInDate, checkOutDate } = req.query;
  try {
    res.status(200).json({
      success: true,
      data: [],
      message: "Lấy danh sách phòng (chức năng cần hoàn thiện logic kiểm tra)",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách phòng",
      error: error.message,
    });
  }
});

exports.updateCustomerInfo = asyncHandler(async (req, res) => {
  const { fullName, phoneNumber, email, address } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const customer = await Customer.findOne({
      accountId: req.user._id,
    }).session(session);
    if (!customer) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin khách hàng",
      });
    }

    if (fullName) customer.fullName = fullName;
    if (phoneNumber) customer.phoneNumber = phoneNumber;
    if (email) customer.email = email; // Be cautious with email updates if it's a login identifier
    if (address) customer.address = address;

    const updatedCustomer = await customer.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Cập nhật thông tin thành công",
      data: updatedCustomer,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Lỗi cập nhật thông tin customer:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật thông tin",
      error: error.message,
    });
  }
});

/**
 * @desc    Customer cancels their own booking
 * @route   PUT /api/v1/bookings/:bookingId/cancel
 * @access  Private (Customer)
 */
exports.customerCancelBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return res.status(400).json({ success: false, message: "Booking ID không hợp lệ." });
  }
  if (!req.user.customerId) {
    return res.status(401).json({
      success: false,
      message: "Không tìm thấy thông tin khách hàng từ token.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await BookingOrder.findById(bookingId).session(session);

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Booking không tồn tại." });
    }

    // Authorization: Customer chỉ hủy được booking của mình
    if (booking.customer.toString() !== req.user.customerId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: "Không có quyền hủy booking này." });
    }

    // Logic kiểm tra điều kiện hủy (ví dụ: trước ngày check-in bao lâu, trạng thái hiện tại)
    // Ví dụ: không cho hủy nếu đã "completed" hoặc "cancelled"
    if (["completed", "cancelled", "rejected"].includes(booking.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Không thể hủy booking ở trạng thái ${booking.status}.`,
      });
    }

    // Ví dụ: Kiểm tra deadline hủy (nếu có)
    // if (booking.modificationDeadline && new Date() > booking.modificationDeadline) {
    //   // Hoặc một deadline hủy riêng
    //   return res.status(400).json({ message: "Đã quá hạn hủy booking." });
    // }

    booking.status = "cancelled";
    // booking.cancelledAt = new Date(); // pre-save hook sẽ xử lý

    // TODO: Xử lý logic hoàn tiền nếu có.
    // Việc này có thể phức tạp:
    // 1. Kiểm tra chính sách hoàn tiền.
    // 2. Nếu đủ điều kiện, tạo một Transaction refund.
    // 3. Gọi API refund của cổng thanh toán.
    // 4. Cập nhật paymentStatus, totalPaid của BookingOrder.
    // Hiện tại, chỉ đổi status, không xử lý refund tự động ở đây.

    const updatedBooking = await booking.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Hủy booking thành công.",
      data: updatedBooking,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Lỗi customer cancel booking:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi hủy booking.",
      error: error.message,
    });
  }
});
