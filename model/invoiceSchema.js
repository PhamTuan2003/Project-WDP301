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
    customerInfo: {
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
    },
    yachtInfo: {
      name: String,
      location: String,
      scheduleInfo: String,
    },
    items: [
      {
        roomId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Room",
        },
        roomName: String,
        quantity: Number,
        unitPrice: Number,
        totalPrice: Number,
        description: String,
      },
    ],
    subtotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    remainingAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["draft", "issued", "paid", "cancelled"],
      default: "issued",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
    },
    notes: String,
    dueDate: Date,
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
    const timestamp = Date.now().toString().slice(-6);
    this.invoiceNumber = `INV${year}${month}${timestamp}`;
  }
  next();
});

// Calculate remaining amount and payment status
invoiceSchema.pre("save", function (next) {
  this.remainingAmount = this.total - this.paidAmount;

  if (this.paidAmount >= this.total) {
    this.paymentStatus = "paid";
  } else if (this.paidAmount > 0) {
    this.paymentStatus = "partial";
  } else {
    this.paymentStatus = "unpaid";
  }

  next();
});

// Virtual for formatted total
invoiceSchema.virtual("formattedTotal").get(function () {
  return this.total?.toLocaleString("vi-VN") + " VNĐ";
});

module.exports = mongoose.model("Invoice", invoiceSchema);
