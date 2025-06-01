const Invoice = require("../model/invoiceSchema");
const Transaction = require("../model/transaction");
const Customer = require("../model/customer");
const PDFDocument = require("pdfkit");
const asyncHandler = require("express-async-handler");

// Lấy invoice theo transaction ID
const getInvoiceByTransaction = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  try {
    const invoice = await Invoice.findOne({ transactionId })
      .populate({
        path: "bookingId",
        populate: [
          { path: "customer" },
          { path: "yacht" },
          { path: "schedule" },
        ],
      })
      .populate("transactionId");

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice không tồn tại",
      });
    }

    // Kiểm tra quyền truy cập
    const customer = await Customer.findOne({ accountId: req.user._id });
    if (invoice.bookingId.customer._id.toString() !== customer._id.toString()) {
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
    console.error("Error getting invoice by transaction:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy invoice",
      error: error.message,
    });
  }
});

// Lấy invoice theo ID
const getInvoiceById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const invoice = await Invoice.findById(id)
      .populate({
        path: "bookingId",
        populate: [
          { path: "customer" },
          { path: "yacht" },
          { path: "schedule" },
        ],
      })
      .populate("transactionId");

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice không tồn tại",
      });
    }

    // Kiểm tra quyền truy cập
    const customer = await Customer.findOne({ accountId: req.user._id });
    if (invoice.bookingId.customer._id.toString() !== customer._id.toString()) {
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

// Download PDF invoice
const downloadInvoicePDF = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const invoice = await Invoice.findById(id)
      .populate({
        path: "bookingId",
        populate: [
          { path: "customer" },
          { path: "yacht" },
          { path: "schedule" },
        ],
      })
      .populate("transactionId");

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice không tồn tại",
      });
    }

    // Kiểm tra quyền truy cập
    const customer = await Customer.findOne({ accountId: req.user._id });
    if (invoice.bookingId.customer._id.toString() !== customer._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền truy cập invoice này",
      });
    }

    // Tạo PDF
    const doc = new PDFDocument();
    const filename = `invoice-${invoice.invoiceNumber}.pdf`;

    res.setHeader("Content-disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-type", "application/pdf");

    doc.pipe(res);

    // Header
    doc.fontSize(20).text("HÓA ĐƠN THANH TOÁN", 50, 50, { align: "center" });
    doc.moveDown();

    // Invoice info
    doc.fontSize(12);
    doc.text(`Số hóa đơn: ${invoice.invoiceNumber}`, 50, 100);
    doc.text(
      `Ngày phát hành: ${invoice.issueDate.toLocaleDateString("vi-VN")}`,
      50,
      115
    );
    doc.text(`Mã booking: ${invoice.bookingId.confirmationCode}`, 50, 130);

    // Company info (left side)
    doc.text("CÔNG TY DU THUYỀN", 50, 160);
    doc.text("Địa chỉ: 123 Đường ABC, Quận XYZ", 50, 175);
    doc.text("Điện thoại: 0123-456-789", 50, 190);
    doc.text("Email: info@yacht.com", 50, 205);

    // Customer info (right side)
    doc.text("THÔNG TIN KHÁCH HÀNG:", 300, 160);
    doc.text(`Tên: ${invoice.customerInfo.fullName}`, 300, 175);
    doc.text(`Email: ${invoice.customerInfo.email}`, 300, 190);
    doc.text(`SĐT: ${invoice.customerInfo.phoneNumber}`, 300, 205);
    if (invoice.customerInfo.address) {
      doc.text(`Địa chỉ: ${invoice.customerInfo.address}`, 300, 220);
    }

    // Yacht info
    if (invoice.yachtInfo.name) {
      doc.text(`Du thuyền: ${invoice.yachtInfo.name}`, 50, 240);
      if (invoice.yachtInfo.location) {
        doc.text(`Địa điểm: ${invoice.yachtInfo.location}`, 50, 255);
      }
      if (invoice.yachtInfo.scheduleInfo) {
        doc.text(`Lịch trình: ${invoice.yachtInfo.scheduleInfo}`, 50, 270);
      }
    }

    // Items table
    let yPosition = 300;
    doc.text("CHI TIẾT DỊCH VỤ:", 50, yPosition);
    yPosition += 20;

    // Table header
    doc.rect(50, yPosition, 500, 20).fill("#f0f0f0");
    doc.fillColor("black");
    doc.text("STT", 60, yPosition + 5);
    doc.text("Tên phòng", 100, yPosition + 5);
    doc.text("SL", 250, yPosition + 5);
    doc.text("Đơn giá", 300, yPosition + 5);
    doc.text("Thành tiền", 450, yPosition + 5);
    yPosition += 25;

    // Table rows
    invoice.items.forEach((item, index) => {
      doc.text(`${index + 1}`, 60, yPosition);
      doc.text(item.roomName, 100, yPosition);
      doc.text(item.quantity.toString(), 250, yPosition);
      doc.text(item.unitPrice.toLocaleString("vi-VN"), 300, yPosition);
      doc.text(item.totalPrice.toLocaleString("vi-VN"), 450, yPosition);
      yPosition += 20;
    });

    // Totals
    yPosition += 20;
    doc.text(
      `Tạm tính: ${invoice.subtotal.toLocaleString("vi-VN")} VNĐ`,
      350,
      yPosition
    );

    if (invoice.discount > 0) {
      yPosition += 15;
      doc.text(
        `Giảm giá: ${invoice.discount.toLocaleString("vi-VN")} VNĐ`,
        350,
        yPosition
      );
    }

    if (invoice.tax > 0) {
      yPosition += 15;
      doc.text(
        `Thuế: ${invoice.tax.toLocaleString("vi-VN")} VNĐ`,
        350,
        yPosition
      );
    }

    yPosition += 15;
    doc.fontSize(14);
    doc.text(
      `Tổng cộng: ${invoice.total.toLocaleString("vi-VN")} VNĐ`,
      350,
      yPosition
    );

    yPosition += 20;
    doc.fontSize(12);
    doc.text(
      `Đã thanh toán: ${invoice.paidAmount.toLocaleString("vi-VN")} VNĐ`,
      350,
      yPosition
    );

    if (invoice.remainingAmount > 0) {
      yPosition += 15;
      doc.text(
        `Còn lại: ${invoice.remainingAmount.toLocaleString("vi-VN")} VNĐ`,
        350,
        yPosition
      );
    }

    // Transaction info
    yPosition += 30;
    doc.text("THÔNG TIN GIAO DỊCH:", 50, yPosition);
    yPosition += 15;
    doc.text(
      `Loại giao dịch: ${
        invoice.transactionId.transaction_type === "deposit"
          ? "Thanh toán cọc"
          : "Thanh toán đầy đủ"
      }`,
      50,
      yPosition
    );
    yPosition += 15;
    doc.text(
      `Mã giao dịch: ${invoice.transactionId.transaction_reference}`,
      50,
      yPosition
    );
    yPosition += 15;
    doc.text(
      `Ngày thanh toán: ${
        invoice.transactionId.completedAt
          ? invoice.transactionId.completedAt.toLocaleDateString("vi-VN")
          : "Chưa thanh toán"
      }`,
      50,
      yPosition
    );

    // Footer
    yPosition += 50;
    doc.text("Cảm ơn quý khách đã sử dụng dịch vụ!", 50, yPosition, {
      align: "center",
    });

    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo PDF",
      error: error.message,
    });
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

    const invoices = await Invoice.find({
      "customerInfo.email": customer.email,
    })
      .populate({
        path: "bookingId",
        populate: [{ path: "yacht", select: "name location" }],
      })
      .populate("transactionId", "transaction_type status completedAt")
      .sort({ createdAt: -1 });

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

module.exports = {
  getInvoiceByTransaction,
  getInvoiceById,
  downloadInvoicePDF,
  getCustomerInvoices,
};
