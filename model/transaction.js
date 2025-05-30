const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BookingOrder",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    transaction_type: {
      type: String,
      enum: ["deposit", "full_payment"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "pending",
    },
    payment_method: {
      type: String,
      enum: ["qr_code", "bank_transfer", "cash"],
      default: "qr_code",
    },
    payment_gateway_response: {
      type: Object,
      default: {},
    },
    transaction_reference: {
      type: String,
      unique: true,
    },
    sender_bank_no: String,
    receiver_bank_no: String,
    transactionDate: {
      type: Date,
      default: Date.now,
    },
    completedAt: Date,
    failureReason: String,
    qr_code_url: String,
    payment_gateway_id: String,
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Generate transaction reference
transactionSchema.pre("save", function (next) {
  if (!this.transaction_reference) {
    this.transaction_reference =
      "TXN" +
      Date.now() +
      Math.random().toString(36).substr(2, 9).toUpperCase();
  }
  next();
});

// Virtual for formatted amount
transactionSchema.virtual("formattedAmount").get(function () {
  return this.amount?.toLocaleString("vi-VN") + " VNĐ";
});

module.exports = mongoose.model("Transaction", transactionSchema);
