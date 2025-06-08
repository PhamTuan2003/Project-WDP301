const Invoice = require("../model/invoiceSchema");
const Customer = require("../model/customer"); // For authorization
const PDFDocument = require("pdfkit");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose"); // For ObjectId validation
const Transaction = require("../model/transaction");

// Lấy invoice theo transaction ID (Mongoose ObjectId)
const getInvoiceByTransaction = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  console.log("[getInvoiceByTransaction] transactionId param:", transactionId);

  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    console.log("[getInvoiceByTransaction] Invalid ObjectId:", transactionId);
    return res
      .status(400)
      .json({ success: false, message: "Transaction ID không hợp lệ." });
  }

  try {
    const invoice = await Invoice.findOne({ transactionId: transactionId })
      .populate({
        path: "bookingId",
        select:
          "bookingCode confirmationCode customer yacht schedule checkInDate customerInfo",
        populate: [
          { path: "customer", select: "fullName email phoneNumber address" },
          { path: "yacht", select: "name location" },
          { path: "schedule", select: "startDate endDate" },
        ],
      })
      .populate(
        "transactionId",
        "transaction_reference transaction_type status completedAt amount payment_method"
      );

    if (!invoice) {
      console.log(
        "[getInvoiceByTransaction] Invoice NOT FOUND for transactionId:",
        transactionId
      );
      // Thử log tất cả invoice có transactionId là gì
      const allInvoices = await Invoice.find({}, "_id transactionId");
      console.log(
        "[getInvoiceByTransaction] All invoice transactionIds:",
        allInvoices.map((i) => i.transactionId)
      );
      return res.status(404).json({
        success: false,
        message: "Invoice không tồn tại cho transaction ID này.",
      });
    }

    // Authorization
    let canAccess = false;
    if (req.user.role === "admin") {
      canAccess = true;
    } else if (invoice.bookingId && invoice.bookingId.customer) {
      // Check against original customer of the booking
      const customer = await Customer.findOne({ accountId: req.user._id });
      if (
        customer &&
        invoice.bookingId.customer._id.toString() === customer._id.toString()
      ) {
        canAccess = true;
      }
    } else if (invoice.customerInfo && invoice.customerInfo.customerId) {
      // Fallback to customerId on invoice itself
      const customer = await Customer.findOne({ accountId: req.user._id });
      if (
        customer &&
        invoice.customerInfo.customerId.toString() === customer._id.toString()
      ) {
        canAccess = true;
      }
    }

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền truy cập invoice này.",
      });
    }

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error("Error getting invoice by transaction:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy invoice.",
      error: error.message,
    });
  }
});

// Lấy invoice theo ID (Invoice's Mongoose ObjectId)
const getInvoiceById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invoice ID không hợp lệ." });
  }

  try {
    const invoice = await Invoice.findById(id)
      .populate({
        path: "bookingId",
        select:
          "bookingCode confirmationCode customer yacht schedule checkInDate customerInfo",
        populate: [
          { path: "customer", select: "fullName email phoneNumber address" },
          { path: "yacht", select: "name location" },
          { path: "schedule", select: "startDate endDate" },
        ],
      })
      .populate(
        "transactionId",
        "transaction_reference transaction_type status completedAt amount payment_method"
      );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice không tồn tại",
      });
    }

    // Authorization (similar to above)
    let canAccess = false;
    if (req.user.role === "admin") {
      canAccess = true;
    } else if (invoice.bookingId && invoice.bookingId.customer) {
      const customer = await Customer.findOne({ accountId: req.user._id });
      if (
        customer &&
        invoice.bookingId.customer._id.toString() === customer._id.toString()
      ) {
        canAccess = true;
      }
    } else if (invoice.customerInfo && invoice.customerInfo.customerId) {
      const customer = await Customer.findOne({ accountId: req.user._id });
      if (
        customer &&
        invoice.customerInfo.customerId.toString() === customer._id.toString()
      ) {
        canAccess = true;
      }
    }

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền truy cập invoice này",
      });
    }

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error("Error getting invoice by ID:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy invoice",
      error: error.message,
    });
  }
});

const downloadInvoicePDF = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invoice ID không hợp lệ." });
  }

  try {
    const invoice = await Invoice.findById(id)
      .populate({
        path: "bookingId",
        select:
          "bookingCode confirmationCode customer yacht schedule checkInDate customerInfo",
        populate: [
          { path: "customer", select: "fullName email phoneNumber address" }, // For fallback if invoice.customerInfo is minimal
          { path: "yacht", select: "name location" },
          { path: "schedule", select: "startDate endDate" },
        ],
      })
      .populate(
        "transactionId",
        "transaction_reference transaction_type status completedAt amount payment_method"
      );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice không tồn tại",
      });
    }

    // Authorization (similar to above)
    let canAccess = false;
    if (req.user.role === "admin") {
      canAccess = true;
    } else if (invoice.bookingId && invoice.bookingId.customer) {
      const customer = await Customer.findOne({ accountId: req.user._id });
      if (
        customer &&
        invoice.bookingId.customer._id.toString() === customer._id.toString()
      ) {
        canAccess = true;
      }
    } else if (invoice.customerInfo && invoice.customerInfo.customerId) {
      const customer = await Customer.findOne({ accountId: req.user._id });
      if (
        customer &&
        invoice.customerInfo.customerId.toString() === customer._id.toString()
      ) {
        canAccess = true;
      }
    }

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền truy cập invoice này",
      });
    }

    const doc = new PDFDocument({ margin: 50, size: "A4" });

    // Đăng ký font (đường dẫn tương đối từ file js)
    doc.registerFont("Archivo", __dirname + "/../fonts/Archivo-Regular.ttf");
    doc.registerFont("Archivo-Bold", __dirname + "/../fonts/Archivo-Bold.ttf");

    // Sử dụng font cho toàn bộ file
    doc.font("Archivo");

    const filename = `invoice-${invoice.invoiceNumber || id}.pdf`;

    res.setHeader("Content-disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-type", "application/pdf");

    doc.pipe(res);

    // Header
    doc.fontSize(18).text("HÓA ĐƠN THANH TOÁN", { align: "center" });
    doc.moveDown(1.5);

    // Invoice Info & Company Info side-by-side
    const infoTopY = doc.y;
    doc.fontSize(10);
    doc.text(`Số HĐ: ${invoice.invoiceNumber}`, { continued: false });
    doc.text(
      `Ngày PH: ${invoice.issueDate?.toLocaleDateString("vi-VN") || "N/A"}`
    );
    if (invoice.bookingId?.bookingCode) {
      doc.text(`Mã Booking: ${invoice.bookingId.bookingCode}`);
    }
    if (invoice.bookingId?.confirmationCode) {
      doc.text(`Mã Xác Nhận: ${invoice.bookingId.confirmationCode}`);
    }
    doc.moveDown();
    doc.text(invoice.companyInfo?.name || "YACHT BOOKING COMPANY", {
      underline: true,
    });
    doc.text(invoice.companyInfo?.address || "123 Ocean Drive, Paradise City");
    doc.text(`Tel: ${invoice.companyInfo?.phone || "0123 456 789"}`);
    doc.text(
      `Email: ${invoice.companyInfo?.email || "contact@yachtbooking.com"}`
    );

    // Customer Info (right side)
    const customerX = 320;
    doc
      .fontSize(10)
      .text("THÔNG TIN KHÁCH HÀNG:", customerX, infoTopY, { underline: true });
    doc.text(
      `Tên: ${invoice.customerInfo?.fullName || "N/A"}`,
      customerX,
      doc.y
    );
    doc.text(
      `Email: ${invoice.customerInfo?.email || "N/A"}`,
      customerX,
      doc.y
    );
    doc.text(
      `SĐT: ${invoice.customerInfo?.phoneNumber || "N/A"}`,
      customerX,
      doc.y
    );
    if (invoice.customerInfo?.address) {
      doc.text(`Địa chỉ: ${invoice.customerInfo.address}`, customerX, doc.y, {
        width: 230,
      });
    }
    doc.moveDown(2);

    // Yacht & Schedule Info
    const yachtInfoY = Math.max(doc.y, doc.y); // Ensure it's below both columns
    doc.x = 50; // Reset x position
    doc.y = yachtInfoY;
    doc.fontSize(10).text("THÔNG TIN DỊCH VỤ:", { underline: true });
    if (invoice.yachtInfo?.name) {
      doc.text(`Du thuyền: ${invoice.yachtInfo.name}`);
    }
    if (invoice.yachtInfo?.checkInDate) {
      doc.text(
        `Ngày đi: ${new Date(invoice.yachtInfo.checkInDate).toLocaleDateString(
          "vi-VN"
        )}`
      );
    }
    if (invoice.yachtInfo?.scheduleInfo) {
      doc.text(`Lịch trình: ${invoice.yachtInfo.scheduleInfo}`);
    }
    doc.moveDown();

    // Items Table
    const tableTop = doc.y;
    const itemDescX = 50;
    const quantityX = 300;
    const unitPriceX = 370;
    const totalPriceX = 460;

    doc.fontSize(10);
    function addRowHeader(y) {
      doc.text("Mô tả dịch vụ", itemDescX, y, {
        width: quantityX - itemDescX - 10,
      });
      doc.text("SL", quantityX, y, {
        width: unitPriceX - quantityX - 10,
        align: "right",
      });
      doc.text("Đơn giá (VNĐ)", unitPriceX, y, {
        width: totalPriceX - unitPriceX - 10,
        align: "right",
      });
      doc.text("Thành tiền (VNĐ)", totalPriceX, y, {
        width: 500 - totalPriceX + 40,
        align: "right",
      }); // page width - x - margin
      doc
        .moveTo(50, y + 15)
        .lineTo(550, y + 15)
        .stroke();
    }

    addRowHeader(tableTop);
    let currentY = tableTop + 20;

    invoice.items.forEach((item) => {
      if (currentY > 700) {
        // Page break logic
        doc.addPage();
        currentY = 50;
        addRowHeader(currentY);
        currentY += 20;
      }
      doc.text(item.name, itemDescX, currentY, {
        width: quantityX - itemDescX - 10,
      });
      doc.text(item.quantity.toString(), quantityX, currentY, {
        width: unitPriceX - quantityX - 10,
        align: "right",
      });
      doc.text(
        item.unitPrice?.toLocaleString("vi-VN") || "0",
        unitPriceX,
        currentY,
        { width: totalPriceX - unitPriceX - 10, align: "right" }
      );
      doc.text(
        item.totalPrice?.toLocaleString("vi-VN") || "0",
        totalPriceX,
        currentY,
        { width: 500 - totalPriceX + 40, align: "right" }
      );
      currentY += 20;
    });
    doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
    currentY += 10;

    // Financial Summary
    const financialsStartX = 350;
    doc.fontSize(10);
    doc.text(`Tạm tính:`, financialsStartX, currentY, { align: "left" });
    doc.text(
      `${invoice.financials?.subtotal?.toLocaleString("vi-VN") || "0"} VNĐ`,
      totalPriceX,
      currentY,
      { align: "right" }
    );
    currentY += 15;

    if (invoice.financials?.totalDiscount > 0) {
      doc.text(`Giảm giá:`, financialsStartX, currentY, { align: "left" });
      doc.text(
        `${invoice.financials.totalDiscount.toLocaleString("vi-VN")} VNĐ`,
        totalPriceX,
        currentY,
        { align: "right" }
      );
      currentY += 15;
    }
    if (invoice.financials?.totalTax > 0) {
      doc.text(`Thuế (VAT):`, financialsStartX, currentY, { align: "left" });
      doc.text(
        `${invoice.financials.totalTax.toLocaleString("vi-VN")} VNĐ`,
        totalPriceX,
        currentY,
        { align: "right" }
      );
      currentY += 15;
    }
    doc.font("Archivo-Bold");
    doc.text(`TỔNG CỘNG:`, financialsStartX, currentY, { align: "left" });
    doc.text(
      `${invoice.financials?.total?.toLocaleString("vi-VN") || "0"} VNĐ`,
      totalPriceX,
      currentY,
      { align: "right" }
    );
    currentY += 15;
    doc.font("Archivo");

    doc.text(`Đã thanh toán:`, financialsStartX, currentY, { align: "left" });
    doc.text(
      `${invoice.financials?.paidAmount?.toLocaleString("vi-VN") || "0"} VNĐ`,
      totalPriceX,
      currentY,
      { align: "right" }
    );
    currentY += 15;

    if (invoice.financials?.remainingAmount > 0) {
      doc.font("Archivo-Bold");
      doc.text(`Còn lại:`, financialsStartX, currentY, { align: "left" });
      doc.text(
        `${invoice.financials.remainingAmount.toLocaleString("vi-VN")} VNĐ`,
        totalPriceX,
        currentY,
        { align: "right" }
      );
      doc.font("Archivo");
      currentY += 15;
    }
    currentY += 10;

    // Transaction Info
    doc.x = 50;
    doc.y = currentY;
    doc.fontSize(10).text("THÔNG TIN THANH TOÁN:", { underline: true });
    if (invoice.transactionId) {
      doc.text(`Phương thức: ${invoice.transactionId.payment_method}`);
      doc.text(`Mã GD: ${invoice.transactionId.transaction_reference}`);
      doc.text(
        `Ngày TT: ${
          invoice.transactionId.completedAt
            ? new Date(invoice.transactionId.completedAt).toLocaleString(
                "vi-VN"
              )
            : "Chưa hoàn tất"
        }`
      );
      doc.text(
        `Trạng thái GD: ${
          invoice.transactionId.statusDisplay || invoice.transactionId.status
        }`
      );
    } else {
      doc.text("Chưa có thông tin giao dịch liên kết.");
    }
    currentY = doc.y + 20;

    // Footer
    if (currentY > 720) {
      doc.addPage();
      currentY = 50;
    }
    doc
      .fontSize(9)
      .text(
        invoice.legal?.terms ||
          "Cảm ơn quý khách đã sử dụng dịch vụ! Hẹn gặp lại.",
        50,
        currentY,
        { align: "center" }
      );

    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    // Ensure response is sent if headers were already set
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Lỗi server khi tạo PDF",
        error: error.message,
      });
    } else {
      // If headers sent, pdfkit might have started streaming. End the stream.
      res.end();
    }
  }
});

// Lấy danh sách invoices của customer
const getCustomerInvoices = asyncHandler(async (req, res) => {
  try {
    const customer = await Customer.findOne({ accountId: req.user._id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin khách hàng",
      });
    }

    // Find invoices where customerInfo.customerId matches
    const invoices = await Invoice.find({
      "customerInfo.customerId": customer._id,
    })
      .populate({
        path: "bookingId",
        select: "bookingCode yacht checkInDate", // Select only necessary for list view
        populate: { path: "yacht", select: "name" },
      })
      .populate("transactionId", "transaction_type status completedAt amount")
      .sort({ issueDate: -1 }); // Sort by issueDate typically

    res.json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    console.error("Error getting customer invoices:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách hóa đơn",
      error: error.message,
    });
  }
});

// Tạo hóa đơn thủ công (admin hoặc backend gọi)
const createInvoiceManual = asyncHandler(async (req, res) => {
  const { transactionId } = req.body;
  if (!transactionId || !mongoose.Types.ObjectId.isValid(transactionId)) {
    return res
      .status(400)
      .json({ success: false, message: "transactionId không hợp lệ" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
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
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy transaction hoặc booking liên kết.",
      });
    }
    const booking = transaction.bookingId;
    const customer = booking.customer;
    let invoiceItems = [];
    if (
      booking.consultationData &&
      booking.consultationData.requestedRooms &&
      booking.consultationData.requestedRooms.length > 0
    ) {
      invoiceItems = booking.consultationData.requestedRooms.map(
        (roomData) => ({
          type: "room",
          name: roomData.name || "Phòng đặt",
          description: roomData.description || "",
          quantity: roomData.quantity,
          unitPrice: roomData.price / roomData.quantity,
          totalPrice: roomData.price,
        })
      );
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
    await session.commitTransaction();
    session.endSession();
    return res.json({ success: true, data: savedInvoice });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Lỗi tạo hóa đơn thủ công:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo hóa đơn thủ công",
      error: error.message,
    });
  }
});

module.exports = {
  getInvoiceByTransaction,
  getInvoiceById,
  downloadInvoicePDF,
  getCustomerInvoices,
  createInvoiceManual,
};
