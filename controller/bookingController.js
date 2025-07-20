const {
  BookingOrder,
  BookingRoom,
  Invoice,
  Transaction,
  Customer,
  Yacht,
  Service,
  BookingService,
} = require("../model");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const {
  sendConsultationEmail,
  sendBookingConfirmationEmail,
} = require("../utils/sendMail");

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
    requestType = "consultation_requested",
    selectedServices,
  } = req.body;

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

  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Thiếu thông tin bắt buộc: ${missingFields.join(", ")}`,
      missingFields,
    });
  }

  const validRequestTypes = ["pending_payment", "consultation_requested"];

  if (!validRequestTypes.includes(requestType)) {
    return res.status(400).json({
      success: false,
      message: "Loại yêu cầu không hợp lệ.",
    });
  }

  if (
    requestType === "pending_payment" &&
    (totalPrice === undefined || totalPrice <= 0)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Tổng giá là bắt buộc và phải lớn hơn 0 cho yêu cầu đặt trực tiếp.",
    });
  }

  if (
    !selectedRooms ||
    !Array.isArray(selectedRooms) ||
    selectedRooms.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng chọn ít nhất một phòng.",
    });
  }

  const checkIn = new Date(checkInDate);

  if (isNaN(checkIn.getTime()) || checkIn < new Date()) {
    return res.status(400).json({
      success: false,
      message: "Ngày check-in không hợp lệ hoặc đã qua.",
    });
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
    const customer = await Customer.findById(req.user.customerId).session(
      session
    );
    if (!customer) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin khách hàng.",
      });
    }
    const customerUpdates = {};
    if (fullName && customer.fullName !== fullName)
      customerUpdates.fullName = fullName;
    if (phoneNumber && customer.phoneNumber !== phoneNumber)
      customerUpdates.phoneNumber = phoneNumber;
    if (email && customer.email !== email) customerUpdates.email = email;
    if (address && customer.address !== address)
      customerUpdates.address = address;

    if (Object.keys(customerUpdates).length > 0) {
      Object.assign(customer, customerUpdates);
      await customer.save({ session });
    }

    const totalGuestCount = parseGuestCount(guestCount);
    const processedServices = (selectedServices || []).map((service, index) => {
      const serviceId = service.serviceId || service._id || service.id;
      const serviceName = service.serviceName || service.name;
      const servicePrice =
        service.servicePrice !== undefined
          ? service.servicePrice
          : service.price;
      const serviceQuantity =
        service.serviceQuantity !== undefined
          ? service.serviceQuantity
          : service.quantity;

      if (!serviceId) {
        throw new Error(`ID dịch vụ thứ ${index + 1} không tồn tại.`);
      }
      if (!serviceName) {
        throw new Error(
          `Tên dịch vụ (serviceName) thứ ${index + 1} không tồn tại.`
        );
      }
      if (typeof servicePrice !== "number" || servicePrice < 0) {
        throw new Error(`Giá dịch vụ thứ ${index + 1} không hợp lệ.`);
      }
      return {
        serviceId,
        serviceName,
        servicePrice,
        serviceQuantity: serviceQuantity || totalGuestCount,
      };
    });

    // Validate room data
    const processedRooms = selectedRooms.map((room, index) => {
      const roomId = room.roomId || room.id;
      const roomName = room.roomName || room.name;
      const roomPrice =
        room.roomPrice !== undefined ? room.roomPrice : room.price;
      const roomQuantity =
        room.roomQuantity !== undefined ? room.roomQuantity : room.quantity;

      if (!roomId || !roomName || !roomQuantity || !roomPrice) {
        throw new Error(`Thông tin phòng thứ ${index + 1} không đầy đủ`);
      }
      if (roomQuantity <= 0 || roomPrice <= 0) {
        throw new Error(`Số lượng và giá phòng phải lớn hơn 0`);
      }
      return {
        roomId: roomId,
        roomName: roomName,
        roomDescription: room.roomDescription || room.description || "",
        roomArea: room.roomArea || room.area || 0,
        roomMaxPeople: room.roomMaxPeople || room.max_people || 1,
        roomPrice: roomPrice,
        roomQuantity: roomQuantity,
        roomBeds: room.roomBeds || room.beds,
        roomImage: room.roomImage || (room.images && room.images[0]) || "",
      };
    });

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
      consultationStatus:
        requestType === "consultation_requested"
          ? "requested"
          : "not_requested",
      requirements: requirements || "",
      guestCount: totalGuestCount,
      adults: req.body.adults ?? 1,
      childrenUnder10: req.body.childrenUnder10 ?? 0,
      childrenAbove10: req.body.childrenAbove10 ?? 0,
      checkInDate: checkIn,
      consultationData: {
        requestedRooms: processedRooms,
        requestServices: processedServices,
        estimatedPrice: totalPrice || 0,
        status:
          requestType === "consultation_requested" ? "pending" : "completed",
        createdAt: new Date(),
      },
      confirmationCode: uuidv4().replace(/-/g, ""),
    };

    const newBookingOrder = new BookingOrder(newBookingOrderData);
    const savedBookingOrder = await newBookingOrder.save({ session });

    // LƯU DỊCH VỤ VÀO BOOKING SERVICES NGAY KHI BOOKING (PENDING_PAYMENT)
    if (
      requestType === "pending_payment" &&
      processedServices &&
      processedServices.length > 0
    ) {
      const bookingServiceDocs = processedServices.map((service) => ({
        bookingId: savedBookingOrder._id,
        serviceId: service.serviceId,
        price: service.servicePrice,
        quantity: service.serviceQuantity,
        serviceName: service.serviceName,
      }));
      await BookingService.insertMany(bookingServiceDocs, { session });
    }

    // Gửi email xác nhận theo loại booking
    try {
      const checkInDateStr = new Date(
        savedBookingOrder.checkInDate
      ).toLocaleDateString("vi-VN");
      if (requestType === "consultation_requested") {
        await sendConsultationEmail(
          email,
          fullName,
          savedBookingOrder.bookingCode,
          checkInDateStr,
          savedBookingOrder.guestCount,
          requirements
        );
      } else if (requestType === "pending_payment") {
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
      // Không throw lỗi này để không ảnh hưởng tới booking, chỉ log lại
    }

    await session.commitTransaction();

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
        selectedServices: selectedServices,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xử lý yêu cầu.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  } finally {
    session.endSession();
  }
});

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
      selectedServices: consultation.consultationData.requestServices,
    },
  });
});

exports.customerConfirmBookingAfterConsultation = asyncHandler(
  async (req, res) => {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res
        .status(400)
        .json({ success: false, message: "Booking ID không hợp lệ." });
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
        return res
          .status(404)
          .json({ success: false, message: "Booking không tồn tại." });
      }

      if (booking.customer.toString() !== req.user.customerId) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({
          success: false,
          message: "Không có quyền xác nhận booking này.",
        });
      }

      if (
        booking.consultationStatus !== "sent" ||
        booking.status === "pending_payment" ||
        booking.status === "confirmed"
      ) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message:
            "Booking không ở trạng thái cho phép xác nhận hoặc đã được xử lý.",
        });
      }

      booking.status = "pending_payment";
      booking.consultationStatus = "responded";

      const savedBooking = await booking.save({ session });

      try {
        const populatedBooking = await BookingOrder.findById(savedBooking._id)
          .populate("yacht", "name")
          .lean();

        const yachtName = populatedBooking.yacht?.name || "(Không rõ)";
        const checkInDateStr = new Date(
          populatedBooking.checkInDate
        ).toLocaleDateString("vi-VN");

        const rooms = (populatedBooking.consultationData?.requestedRooms || [])
          .map(
            (room) =>
              `<li>${room.roomName} x ${room.roomQuantity} (${
                room.roomArea || "?"
              }m²) - ${room.roomPrice?.toLocaleString("vi-VN") || "?"} VNĐ</li>`
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
        console.error(
          "Lỗi gửi email xác nhận đặt phòng sau tư vấn:",
          mailErr.message
        );
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
  }
);

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
      if (
        !customer ||
        booking.customer.toString() !== customer._id.toString()
      ) {
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
        const bookingRoomPromises = booking.consultationData.requestedRooms.map(
          (roomData) => {
            const newBookingRoom = new BookingRoom({
              bookingId: booking._id,
              roomId: roomData.roomId,
              quantity: roomData.roomQuantity,
              price: roomData.roomPrice,
            });
            return newBookingRoom.save({ session });
          }
        );
        await Promise.all(bookingRoomPromises);
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
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật status booking.",
      error: error.message,
    });
  }
});

exports.confirmBooking = asyncHandler(async (req, res) => {
  const { id } = req.params; // BookingOrder ID
  const { scheduleId, selectedServices = [] } = req.body;

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

    if (booking.status === "confirmed") {
      await session.abortTransaction(); // No need to re-confirm
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Booking này đã được xác nhận trước đó.",
      });
    }

    // Typically, confirmation moves from 'consultation_requested' or 'consultation_sent'
    if (
      !["consultation_requested", "consultation_sent"].includes(booking.status)
    ) {
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
      const bookingRoomPromises = booking.consultationData.requestedRooms.map(
        (roomData) => {
          const newBookingRoom = new BookingRoom({
            bookingId: booking._id,
            roomId: roomData.roomId,
            quantity: roomData.roomQuantity,
            price: roomData.roomPrice,
          });
          return newBookingRoom.save({ session });
        }
      );
      await Promise.all(bookingRoomPromises);
    } else if (existingBookingRooms.length === 0) {
    }

    // Lưu các dịch vụ đi kèm khi xác nhận booking
    const requestServices = booking.consultationData?.requestServices || [];
    if (Array.isArray(requestServices) && requestServices.length > 0) {
      await BookingService.deleteMany({ bookingId: booking._id }, { session }); // Xóa cũ nếu có
      const bookingServiceDocs = requestServices.map((service) => ({
        bookingId: booking._id,
        serviceId: service.serviceId,
        price: service.servicePrice,
        quantity: service.serviceQuantity,
        name: service.serviceName,
      }));
      await BookingService.insertMany(bookingServiceDocs, { session });
    }

    const updatedBooking = await booking.save({ session });
    await session.commitTransaction();
    session.endSession();

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
    res.status(500).json({
      success: false,
      message: "Lỗi server khi hủy/từ chối booking.",
      error: error.message,
    });
  }
});
// NEW: Controller to UPDATE an existing request
exports.updateBookingOrConsultationRequest = asyncHandler(async (req, res) => {
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
    return res
      .status(400)
      .json({ success: false, message: "Booking ID không hợp lệ." });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bookingOrder = await BookingOrder.findById(bookingId).session(
      session
    );

    if (!bookingOrder) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy yêu cầu booking." });
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
    if (fullName) bookingOrder.customerInfo.fullName = fullName;
    if (phoneNumber) bookingOrder.customerInfo.phoneNumber = phoneNumber;
    if (email) bookingOrder.customerInfo.email = email;
    if (address) bookingOrder.customerInfo.address = address;

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
    bookingOrder.consultationData.requestedRooms = selectedRooms.map(
      (room) => ({
        roomId: room.roomId,
        roomName: room.roomName,
        roomQuantity: room.roomQuantity,
        roomPrice: room.roomPrice,
        roomDescription: room.roomDescription,
        roomArea: room.roomArea,
        roomAvatar: room.roomAvatar,
        roomMaxPeople: room.roomMaxPeople,
        roomBeds: room.roomBeds,
        roomImage: room.roomImage,
      })
    );
    bookingOrder.consultationData.estimatedPrice = totalPrice || 0;
    bookingOrder.consultationData.updatedAt = new Date();

    // Apply customer info updates if any
    if (Object.keys(bookingOrder.customerInfo).length > 0) {
      Object.assign(bookingOrder, { customerInfo: bookingOrder.customerInfo });
    }

    const savedBookingOrder = await bookingOrder.save({ session });

    // Nếu chuyển sang pending_payment, tạo lại BookingRoom
    if (requestType === "pending_payment") {
      await BookingRoom.deleteMany(
        { bookingId: savedBookingOrder._id },
        { session }
      );
      for (const room of selectedRooms) {
        await BookingRoom.create(
          [
            {
              bookingId: savedBookingOrder._id,
              roomId: room.roomId,
              quantity: room.roomQuantity,
              price: room.roomPrice,
            },
          ],
          { session }
        );
      }
    }

    // Xử lý cập nhật dịch vụ đi kèm
    const requestServices =
      savedBookingOrder.consultationData?.requestServices || [];
    if (Array.isArray(requestServices) && requestServices.length > 0) {
      await BookingService.deleteMany(
        { bookingId: savedBookingOrder._id },
        { session }
      ); // Xóa cũ nếu có
      const bookingServiceDocs = requestServices.map((service) => ({
        bookingId: savedBookingOrder._id,
        serviceId: service.serviceId,
        price: service.servicePrice,
        quantity: service.serviceQuantity,
        name: service.serviceName,
      }));
      await BookingService.insertMany(bookingServiceDocs, { session });
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
    return res
      .status(400)
      .json({ success: false, message: "Booking ID không hợp lệ." });
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
      if (
        customer &&
        booking.customer._id.toString() === customer._id.toString()
      ) {
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

    // Lấy dịch vụ đã lưu
    const services = await BookingService.find({
      bookingId: booking._id,
    }).populate("serviceId");

    res.json({
      success: true,
      data: {
        booking,
        transactions,
        bookedRooms,
        invoices, // Replaced 'bill' with 'invoices' as it's an array
        services, // Thêm dòng này
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy booking.",
      error: error.message,
    });
  }
});

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

exports.getCustomerBookingDetail = asyncHandler(async (req, res) => {
  if (!req.user.customerId) {
    return res.status(401).json({
      success: false,
      message: "Không tìm thấy thông tin khách hàng từ token.",
    });
  }
  const { bookingId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(req.params.bookingId)) {
    return res
      .status(400)
      .json({ success: false, message: "Booking ID không hợp lệ." });
  }

  const booking = await BookingOrder.findById(bookingId)
    .populate("yacht", "name images location")
    .populate("schedule", "startDate endDate")
    .populate({ path: "customer", select: "fullName email phoneNumber" });

  if (!booking) {
    return res
      .status(404)
      .json({ success: false, message: "Booking không tồn tại." });
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
  }).populate("roomId", "name price");

  // Lấy dịch vụ đã lưu
  const services = await BookingService.find({
    bookingId: booking._id,
  }).populate("serviceId");

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
      services,
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
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật thông tin",
      error: error.message,
    });
  }
});

exports.customerCancelBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return res
      .status(400)
      .json({ success: false, message: "Booking ID không hợp lệ." });
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
      return res
        .status(404)
        .json({ success: false, message: "Booking không tồn tại." });
    }

    // Authorization: Customer chỉ hủy được booking của mình
    if (booking.customer.toString() !== req.user.customerId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(403)
        .json({ success: false, message: "Không có quyền hủy booking này." });
    }

    if (["completed", "cancelled", "rejected"].includes(booking.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Không thể hủy booking ở trạng thái ${booking.status}.`,
      });
    }

    booking.status = "cancelled";

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
    res.status(500).json({
      success: false,
      message: "Lỗi server khi hủy booking.",
      error: error.message,
    });
  }
});

// Thêm API lưu dịch vụ tư vấn vào consultationData.requestServices
exports.saveConsultationServices = async (req, res) => {
  try {
    const { bookingOrderId, requestServices } = req.body;
    const booking = await BookingOrder.findByIdAndUpdate(
      bookingOrderId,
      { "consultationData.requestServices": requestServices },
      { new: true }
    );
    res.json(booking);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteBookingOrder = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return res
      .status(400)
      .json({ success: false, message: "Booking ID không hợp lệ." });
  }

  // Chỉ cho phép xóa booking đã huỷ và thuộc về user hiện tại
  const bookingOrder = await BookingOrder.findOne({
    _id: bookingId,
    customer: req.user.customerId,
    status: "cancelled",
  });

  if (!bookingOrder) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy booking đã huỷ hoặc bạn không có quyền.",
    });
  }

  await bookingOrder.deleteOne();

  res.status(200).json({
    success: true,
    message: "Booking đã được xóa thành công.",
  });
});

// Lấy toàn bộ bookingOrder theo idCompany (chỉ cho admin)
exports.getAllBookingOrders = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền truy cập!'
    });
  }
  const { idCompany } = req.query;
  if (!idCompany) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu idCompany!'
    });
  }
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const filter = { };
  // BookingOrder có thể lưu company dưới trường IdCompanys hoặc companyId hoặc yacht.IdCompanys tuỳ thiết kế
  // Giả sử trường là IdCompanys (nếu khác báo lại)
  filter["IdCompanys"] = idCompany;

  const total = await BookingOrder.countDocuments(filter);
  const data = await BookingOrder.find(filter)
    .populate('customer', 'fullName email phoneNumber')
    .populate('yacht', 'name')
    .populate('schedule', 'startDate endDate')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    total,
    page,
    limit,
    data
  });
});

// Lấy danh sách bookingOrder của company thông qua bảng Yacht (chỉ cho admin)
exports.getBookingOrdersByCompany = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền truy cập!'
    });
  }
  const { idCompany } = req.query;
  if (!idCompany) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu idCompany!'
    });
  }
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  // Lấy tất cả yacht thuộc công ty
  const yachts = await Yacht.find({ IdCompanys: idCompany }).select('_id');
  const yachtIds = yachts.map(y => y._id);

  // Lấy tất cả bookingOrder có yacht thuộc danh sách trên
  const total = await BookingOrder.countDocuments({ yacht: { $in: yachtIds } });
  const data = await BookingOrder.find({ yacht: { $in: yachtIds } })
    .populate('customer', 'fullName email phoneNumber')
    .populate('yacht', 'name')
    .populate('schedule', 'startDate endDate')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    total,
    page,
    limit,
    data
  });
});
