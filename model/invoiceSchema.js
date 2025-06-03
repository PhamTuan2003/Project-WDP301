// models/invoice.js
const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
    },

    issueDate: {
      type: Date,
      default: Date.now,
    },

    dueDate: {
      type: Date,
      required: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BookingOrder",
      required: true,
    },

    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },

    // Customer information
    customerInfo: {
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: true,
      },
      fullName: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
      phoneNumber: {
        type: String,
        required: true,
      },
      address: String,
      taxId: String, // Mã số thuế nếu là doanh nghiệp
    },

    // Company information (for invoice)
    companyInfo: {
      name: { type: String, default: "Yacht Booking Company" },
      address: String,
      phone: String,
      email: String,
      taxId: String,
      website: String,
      logo: String,
    },

    // Yacht and booking information
    yachtInfo: {
      yachtId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Yacht",
      },
      name: String,
      location: String,
      scheduleInfo: String,
      checkInDate: Date,
      checkOutDate: Date,
    },

    // Invoice items (rooms, services, etc.)
    items: [
      {
        type: {
          type: String,
          enum: ["room", "service", "extra", "fee", "discount"],
          required: true,
        },
        itemId: mongoose.Schema.Types.ObjectId,
        name: {
          type: String,
          required: true,
        },
        description: String,
        quantity: {
          type: Number,
          required: true,
          min: 0,
        },
        unitPrice: {
          type: Number,
          required: true,
          min: 0,
        },
        totalPrice: {
          type: Number,
          required: true,
          min: 0,
        },
        taxRate: {
          type: Number,
          default: 0,
          min: 0,
          max: 100,
        },
        taxAmount: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],

    // Financial calculations
    financials: {
      subtotal: {
        type: Number,
        required: true,
        min: 0,
      },
      totalTax: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalDiscount: {
        type: Number,
        default: 0,
        min: 0,
      },
      total: {
        type: Number,
        required: true,
        min: 0,
      },
      paidAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
      remainingAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // Payment information
    paymentInfo: {
      paymentMethod: String,
      transactionReference: String,
      paidAt: Date,
      paymentNote: String,
    },

    status: {
      type: String,
      enum: [
        "draft",
        "issued",
        "paid",
        "partially_paid",
        "overdue",
        "cancelled",
      ],
      default: "issued",
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid", "refunded"],
      default: "unpaid",
    },

    // Additional fields
    currency: {
      type: String,
      default: "VND",
    },

    notes: String,
    internalNotes: String, // Notes chỉ internal staff xem được

    // Template and branding
    template: {
      type: String,
      default: "standard",
    },

    // Legal and compliance
    legal: {
      terms: String,
      vatApplicable: { type: Boolean, default: false },
      vatNumber: String,
      legalText: String,
    },

    // Audit trail
    auditTrail: [
      {
        action: String, // "created", "sent", "paid", "cancelled"
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Staff",
        },
        performedAt: {
          type: Date,
          default: Date.now,
        },
        details: String,
        ipAddress: String,
      },
    ],

    // Email tracking
    emailTracking: [
      {
        sentAt: Date,
        sentTo: String,
        subject: String,
        openedAt: Date,
        opened: { type: Boolean, default: false },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Generate invoice number
invoiceSchema.pre("save", function (next) {
  if (!this.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const timestamp = Date.now().toString().slice(-6);
    this.invoiceNumber = `INV${year}${month}${day}${timestamp}`;
  }

  // Set due date if not set (30 days from issue date)
  if (!this.dueDate) {
    this.dueDate = new Date(
      this.issueDate.getTime() + 30 * 24 * 60 * 60 * 1000
    );
  }

  next();
});

// Calculate financials before saving
invoiceSchema.pre("save", function (next) {
  // Calculate subtotal and taxes
  this.financials.subtotal = this.items.reduce(
    (sum, item) => sum + item.totalPrice,
    0
  );
  this.financials.totalTax = this.items.reduce(
    (sum, item) => sum + (item.taxAmount || 0),
    0
  );

  // Calculate total
  this.financials.total =
    this.financials.subtotal +
    this.financials.totalTax -
    this.financials.totalDiscount;

  // Calculate remaining amount
  this.financials.remainingAmount =
    this.financials.total - this.financials.paidAmount;

  // Update payment status
  if (this.financials.paidAmount >= this.financials.total) {
    this.paymentStatus = "paid";
    this.status = "paid";
  } else if (this.financials.paidAmount > 0) {
    this.paymentStatus = "partial";
    this.status = "partially_paid";
  } else {
    this.paymentStatus = "unpaid";
    if (this.dueDate && new Date() > this.dueDate) {
      this.status = "overdue";
    }
  }

  next();
});

// Virtual fields
invoiceSchema.virtual("formattedTotal").get(function () {
  return this.financials.total?.toLocaleString("vi-VN") + " VNĐ";
});

invoiceSchema.virtual("isOverdue").get(function () {
  return (
    this.dueDate && new Date() > this.dueDate && this.paymentStatus !== "paid"
  );
});

// Methods
invoiceSchema.methods.addAuditEntry = function (
  action,
  performedBy,
  details,
  ipAddress
) {
  this.auditTrail.push({
    action,
    performedBy,
    details,
    ipAddress,
    performedAt: new Date(),
  });
};

invoiceSchema.methods.markAsSent = function (email) {
  this.emailTracking.push({
    sentAt: new Date(),
    sentTo: email,
    subject: `Hóa đơn ${this.invoiceNumber}`,
  });
};

module.exports = mongoose.model("Invoice", invoiceSchema);
