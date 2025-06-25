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

    const doc = new PDFDocument({ margin: 0, size: "A4" });
    doc.registerFont("Archivo", __dirname + "/../fonts/Archivo-Regular.ttf");
    doc.registerFont("Archivo-Bold", __dirname + "/../fonts/Archivo-Bold.ttf");
    doc.font("Archivo");

    const filename = `invoiceBooking.pdf`;
    res.setHeader(
      "Content-disposition",
      `attachment; filename=\"${filename}\"`
    );
    res.setHeader("Content-type", "application/pdf");
    doc.pipe(res);

    // HEADER GRADIENT
    doc.save();
    for (let i = 0; i < 595; i += 5) {
      doc
        .rect(i, 0, 5, 70)
        .fillColor(
          `#${(38 + Math.floor((i / 595) * (30 - 38))).toString(16)}63eb`
        )
        .fill();
    }
    doc.restore();
    doc
      .font("Archivo-Bold")
      .fontSize(22)
      .fillColor("#fff")
      .text("HÓA ĐƠN THANH TOÁN", 0, 20, { align: "center" });
    doc.fontSize(12).text("Hóa đơn điện tử", 0, 48, { align: "center" });
    doc.fillColor("#000");
    doc.moveDown();

    // THÔNG TIN ĐỊNH DANH HÓA ĐƠN (box vàng)
    doc.roundedRect(40, 80, 515, 55, 8).fillAndStroke("#fffbe6", "#f59e42");
    doc.fontSize(10).fillColor("#000").font("Archivo");
    doc.text(`Ký hiệu hóa đơn: AB/20E`, 55, 90);
    doc.text(`Số hóa đơn: ${invoice.invoiceNumber}`, 220, 90, { width: 150 });
    doc.text(
      `Ngày phát hành: ${
        invoice.issueDate?.toLocaleDateString("vi-VN") || "N/A"
      }`,
      400,
      90
    );

    // THÔNG TIN NGƯỜI BÁN (box xanh)
    doc.roundedRect(40, 145, 240, 110, 10).fillAndStroke("#f0f9ff", "#67e8f9");
    doc
      .font("Archivo-Bold")
      .fontSize(11)
      .fillColor("#2563eb")
      .text("Thông tin người bán", 55, 155);
    doc.font("Archivo").fontSize(10).fillColor("#000");
    doc.text(
      `Tên công ty: ${invoice.companyInfo?.name || "CÔNG TY DU THUYỀN"}`,
      55,
      170
    );
    doc.text(`Địa chỉ: ${invoice.companyInfo?.address || "..."}`, 55, 185, {
      width: 210,
    });
    doc
      .fillColor("#e11d48")
      .text(
        `Mã số thuế: ${invoice.companyInfo?.taxCode || "0123456789"}`,
        55,
        200
      );
    doc
      .fillColor("#000")
      .text(
        `Điện thoại: ${invoice.companyInfo?.phone || "0123-456-789"}`,
        55,
        215
      );
    doc
      .fillColor("#000")
      .text(
        `Email: ${invoice.companyInfo?.email || "info@yacht.com"}`,
        55,
        230,
        { width: 210 }
      );
    doc
      .fillColor("#2563eb")
      .text(
        `Website: ${invoice.companyInfo?.website || "www.yacht.com"}`,
        55,
        245
      );
    doc.fillColor("#000");

    // THÔNG TIN NGƯỜI MUA (box xám)
    doc.roundedRect(315, 145, 240, 110, 10).fillAndStroke("#f3f4f6", "#67e8f9");
    doc
      .font("Archivo-Bold")
      .fontSize(11)
      .fillColor("#22c55e")
      .text("Thông tin người mua", 330, 155);
    doc.font("Archivo").fontSize(10).fillColor("#000");
    doc.text(`Họ và tên: ${invoice.customerInfo?.fullName || "N/A"}`, 330, 170);
    if (invoice.customerInfo?.address)
      doc.text(`Địa chỉ: ${invoice.customerInfo.address}`, 330, 185, {
        width: 210,
      });
    if (invoice.customerInfo?.taxCode)
      doc
        .fillColor("#e11d48")
        .text(`Mã số thuế: ${invoice.customerInfo.taxCode}`, 330, 200);
    doc
      .fillColor("#000")
      .text(
        `Số điện thoại: ${invoice.customerInfo?.phoneNumber || "N/A"}`,
        330,
        215
      );
    doc.text(`Email: ${invoice.customerInfo?.email || "N/A"}`, 330, 230, {
      width: 210,
    });
    doc.fillColor("#000");

    // THÔNG TIN DỊCH VỤ (box xanh nhạt)
    let yService = 270;
    doc
      .roundedRect(40, yService, 515, 70, 10)
      .fillAndStroke("#f0fdfa", "#5eead4");
    doc
      .font("Archivo-Bold")
      .fontSize(11)
      .fillColor("#0e7490")
      .text("Thông tin dịch vụ", 55, yService + 10);
    doc.font("Archivo").fontSize(10).fillColor("#000");
    let y = yService + 28;
    if (invoice.yachtInfo?.name)
      doc.text(`Du thuyền: ${invoice.yachtInfo.name}`, 55, y);
    if (invoice.yachtInfo?.location)
      doc.text(`Địa điểm: ${invoice.yachtInfo.location}`, 200, y);
    if (invoice.yachtInfo?.scheduleInfo)
      doc.text(`Lịch trình: ${invoice.yachtInfo.scheduleInfo}`, 370, y);
    y += 15;
    if (invoice.yachtInfo?.checkInDate)
      doc.text(
        `Ngày nhận phòng: ${new Date(
          invoice.yachtInfo.checkInDate
        ).toLocaleDateString("vi-VN")}`,
        55,
        y
      );
    if (invoice.yachtInfo?.checkOutDate)
      doc.text(
        `Ngày trả phòng: ${new Date(
          invoice.yachtInfo.checkOutDate
        ).toLocaleDateString("vi-VN")}`,
        200,
        y
      );
    if (invoice.guestInfo) {
      doc.text(
        `Số khách: ${invoice.guestInfo.adults || 0} người lớn` +
          (typeof invoice.guestInfo.childrenUnder10 === "number"
            ? `, ${invoice.guestInfo.childrenUnder10} trẻ em dưới 10 tuổi`
            : "") +
          (typeof invoice.guestInfo.childrenAbove10 === "number"
            ? `, ${invoice.guestInfo.childrenAbove10} trẻ em từ 10 tuổi`
            : ""),
        370,
        y
      );
      y += 15;
      doc
        .fontSize(9)
        .fillColor("#64748b")
        .text(
          `Tổng khách quy đổi: ${
            invoice.guestInfo.adults +
            Math.ceil((invoice.guestInfo.childrenAbove10 || 0) / 2)
          } (2 trẻ em từ 10 tuổi tính là 1 người lớn, trẻ em dưới 10 tuổi không tính)`,
          370,
          y,
          { width: 180 }
        );
      doc.fontSize(10).fillColor("#000");
    }

    // BẢNG CHI TIẾT DỊCH VỤ
    let tableY = yService + 85;
    const tableHeight = 30 + 24 * (invoice.items?.length || 1); // tăng chiều cao mỗi dòng
    doc.roundedRect(40, tableY, 515, tableHeight, 8).stroke("#60a5fa");
    doc.rect(40, tableY, 515, 30).fill("#eff6ff");
    doc.font("Archivo-Bold").fontSize(10).fillColor("#2563eb");
    // Cột: STT(35), Tên(140), Đơn vị(60), Số lượng(60), Đơn giá(100), Thành tiền(120)
    doc.text("STT", 50, tableY + 8, { width: 35, align: "center" });
    doc.text("Tên hàng hóa, dịch vụ", 85, tableY + 8, { width: 140 });
    doc.text("Đơn vị", 225, tableY + 8, { width: 60, align: "center" });
    doc.text("Số lượng", 285, tableY + 8, { width: 60, align: "center" });
    doc.text("Đơn giá", 345, tableY + 8, { width: 100, align: "right" });
    doc.text("Thành tiền", 445, tableY + 8, { width: 110, align: "right" });
    doc.font("Archivo").fillColor("#000");
    let rowY = tableY + 30;
    invoice.items?.forEach((item, idx) => {
      doc.text(idx + 1, 50, rowY + 6, { width: 35, align: "center" });
      doc.text(item.name, 85, rowY + 6, { width: 140 });
      const unit =
        item.name && item.name.toLowerCase().includes("phòng")
          ? "Phòng"
          : "Người";
      doc.text(unit, 225, rowY + 6, { width: 60, align: "center" });
      doc.text(item.quantity, 285, rowY + 6, { width: 60, align: "center" });
      doc.text(item.unitPrice?.toLocaleString("vi-VN") || "0", 345, rowY + 6, {
        width: 100,
        align: "right",
      });
      doc.text(item.totalPrice?.toLocaleString("vi-VN") || "0", 445, rowY + 6, {
        width: 110,
        align: "right",
      });
      rowY += 24;
    });

    // TỔNG TIỀN (box đỏ-xanh)
    let totalY = rowY + 16;
    doc
      .roundedRect(320, totalY, 235, 98, 10)
      .fillAndStroke("#fef2f2", "#fca5a5");
    let yTotal = totalY + 10;
    doc.font("Archivo").fontSize(10).fillColor("#000");
    doc.text("Tổng tiền hàng hóa, dịch vụ", 330, yTotal);
    doc.text(
      invoice.financials?.subtotal?.toLocaleString("vi-VN") || "0",
      520,
      yTotal,
      { align: "right" }
    );
    yTotal += 15;
    if (invoice.financials?.totalDiscount > 0) {
      doc.fillColor("#ef4444").text("Chiết khấu thương mại", 330, yTotal);
      doc.text(
        "-" + invoice.financials.totalDiscount.toLocaleString("vi-VN"),
        520,
        yTotal,
        { align: "right" }
      );
      yTotal += 15;
    }
    doc.fillColor("#000").text("Tiền chưa có thuế VAT", 330, yTotal);
    doc.text(
      (
        invoice.financials?.subtotal - invoice.financials?.totalDiscount
      ).toLocaleString("vi-VN"),
      520,
      yTotal,
      { align: "right" }
    );
    yTotal += 15;
    doc.fillColor("#f59e42").text("Thuế VAT (5%)", 330, yTotal);
    doc.text(
      invoice.financials?.totalTax?.toLocaleString("vi-VN") || "0",
      520,
      yTotal,
      { align: "right" }
    );
    yTotal += 15;
    doc
      .font("Archivo-Bold")
      .fillColor("#2563eb")
      .text("TỔNG TIỀN THANH TOÁN", 330, yTotal);
    doc.text(
      invoice.financials?.total?.toLocaleString("vi-VN") || "0",
      520,
      yTotal,
      { align: "right" }
    );
    yTotal += 18;
    doc.font("Archivo").fillColor("#22c55e").text("Đã thanh toán", 330, yTotal);
    doc.text(
      invoice.financials?.paidAmount?.toLocaleString("vi-VN") || "0",
      520,
      yTotal,
      { align: "right" }
    );
    yTotal += 15;
    if (invoice.financials?.remainingAmount > 0) {
      doc.fillColor("#f59e42").text("Còn lại", 330, yTotal);
      doc.text(
        invoice.financials?.remainingAmount?.toLocaleString("vi-VN") || "0",
        520,
        yTotal,
        { align: "right" }
      );
      doc.fillColor("#000");
    }

    // THÔNG TIN THANH TOÁN (box xanh nhạt)
    let payY = totalY + 110;
    doc.roundedRect(40, payY, 515, 60, 10).fillAndStroke("#f0fdf4", "#bbf7d0");
    doc
      .font("Archivo-Bold")
      .fontSize(11)
      .fillColor("#a21caf")
      .text("Thông tin thanh toán", 55, payY + 8);
    doc.font("Archivo").fontSize(10).fillColor("#000");
    let yPay = payY + 25;
    if (invoice.transactionId) {
      doc.text(
        `Loại giao dịch: ${
          invoice.transactionId.transaction_type === "deposit"
            ? "Thanh toán cọc"
            : "Thanh toán đầy đủ"
        }`,
        55,
        yPay
      );
      doc.text(
        `Mã giao dịch: ${invoice.transactionId.transaction_reference || "N/A"}`,
        200,
        yPay
      );
      doc.fillColor("#22c55e").text("Trạng thái: Thành công", 370, yPay);
      doc.fillColor("#000");
      yPay += 15;
      doc.text(
        `Thời gian thanh toán: ${
          invoice.transactionId.completedAt
            ? new Date(invoice.transactionId.completedAt).toLocaleString(
                "vi-VN"
              )
            : "N/A"
        }`,
        55,
        yPay
      );
    } else {
      doc.text("Chưa có thông tin giao dịch liên kết.", 55, yPay);
    }

    // GHI CHÚ (nếu có)
    if (invoice.notes) {
      let noteY = payY + 70;
      doc
        .roundedRect(40, noteY, 515, 40, 10)
        .fillAndStroke("#fffbe6", "#fde68a");
      doc
        .font("Archivo-Bold")
        .fontSize(11)
        .fillColor("#f59e42")
        .text("Ghi chú", 55, noteY + 8);
      doc
        .font("Archivo")
        .fontSize(10)
        .fillColor("#f59e42")
        .text(invoice.notes, 120, noteY + 8, { width: 420 });
      doc.fillColor("#000");
    }

    // CHỮ KÝ (2 cột, căn giữa)
    let signY = payY + 120;
    doc
      .font("Archivo-Bold")
      .fontSize(11)
      .fillColor("#000")
      .text("NGƯỜI MUA", 100, signY, { width: 120, align: "center" });
    doc
      .font("Archivo")
      .fontSize(9)
      .fillColor("#64748b")
      .text("(Ký, ghi rõ họ tên)", 100, signY + 15, {
        width: 120,
        align: "center",
      });
    doc
      .moveTo(130, signY + 50)
      .lineTo(210, signY + 50)
      .stroke("#e5e7eb");
    doc
      .font("Archivo")
      .fontSize(10)
      .fillColor("#000")
      .text(invoice.customerInfo?.fullName || "", 100, signY + 55, {
        width: 120,
        align: "center",
      });
    doc
      .font("Archivo-Bold")
      .fontSize(11)
      .fillColor("#000")
      .text("NGƯỜI BÁN", 400, signY, { width: 120, align: "center" });
    doc
      .font("Archivo")
      .fontSize(9)
      .fillColor("#64748b")
      .text("(Ký, đóng dấu, ghi rõ họ tên)", 400, signY + 15, {
        width: 120,
        align: "center",
      });
    doc
      .moveTo(430, signY + 50)
      .lineTo(510, signY + 50)
      .stroke("#e5e7eb");
    doc
      .font("Archivo")
      .fontSize(10)
      .fillColor("#000")
      .text(
        invoice.companyInfo?.name || "Công ty TNHH Du thuyền",
        400,
        signY + 55,
        { width: 120, align: "center" }
      );

    // FOOTER CẢM ƠN (gradient hồng, căn giữa)
    let footerY = signY + 90;
    doc.save();
    for (let i = 0; i < 515; i += 5) {
      doc
        .rect(40 + i, footerY, 5, 40)
        .fillColor(
          `#${(192 + Math.floor((i / 515) * (219 - 192))).toString(16)}26d3`
        )
        .fill();
    }
    doc.restore();
    doc
      .font("Archivo-Bold")
      .fontSize(14)
      .fillColor("#fff")
      .text("Cảm ơn quý khách!", 40, footerY + 10, {
        width: 515,
        align: "center",
      });
    doc
      .font("Archivo")
      .fontSize(10)
      .fillColor("#dbeafe")
      .text(
        "Chúng tôi hy vọng được phục vụ quý khách trong những chuyến đi tiếp theo.",
        40,
        footerY + 28,
        { width: 515, align: "center" }
      );
    doc.fillColor("#000");

    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Lỗi server khi tạo PDF",
        error: error.message,
      });
    } else {
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
