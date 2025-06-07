// models/transaction.js
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BookingOrder",
      required: true,
    },

    // Thêm booking code để dễ tracking
    bookingCode: {
      type: String,
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    transaction_type: {
      type: String,
      enum: [
        "deposit",
        "partial_payment",
        "final_payment",
        "full_payment",
        "refund",
      ],
      required: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
        "expired",
      ],
      default: "pending",
    },

    // Cải thiện payment methods
    payment_method: {
      type: String,
      enum: ["vnpay", "momo", "bank_transfer", "cash", "card", "unknown"],
      required: true,
    },

    // Chi tiết response từ các gateways
    gateway_response: {
      // VNPay response
      vnpay: { type: mongoose.Schema.Types.Mixed, default: {} },

      // MoMo response
      momo: { type: mongoose.Schema.Types.Mixed, default: {} },

      // Bank transfer info
      bank: { type: mongoose.Schema.Types.Mixed, default: {} },
    },

    transaction_reference: {
      type: String,
      unique: true,
      index: true,
    },

    // Thông tin chuyển khoản chi tiết
    banking_info: {
      sender_bank: String,
      sender_account: String,
      sender_name: String,
      receiver_bank: String,
      receiver_account: String,
      receiver_name: String,
      transfer_content: String,
      transfer_time: Date,
    },

    transactionDate: {
      type: Date,
      default: Date.now,
    },

    completedAt: Date,
    expiredAt: Date,
    failureReason: String,
    qr_code_url: String,
    payment_gateway_id: String,
    notes: String,

    // Thêm fields cho security và tracking
    security: {
      ipAddress: String,
      userAgent: String,
      deviceFingerprint: String,
      riskScore: { type: Number, min: 0, max: 100 },
    },

    // Webhook và callback tracking
    webhooks: [
      {
        url: String,
        status: String,
        response: String,
        attemptedAt: Date,
        responseTime: Number,
      },
    ],

    // Refund information
    refund: {
      refundAmount: Number,
      refundReason: String,
      refundedAt: Date,
      refundTransactionId: String,
      refundedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Staff",
      },
    },

    // Metadata for analytics
    metadata: {
      source: String, // web, mobile, api
      campaign: String,
      affiliateId: String,
      promotionCode: String,
    },
    gatewayInteraction: {
      requestPayload: mongoose.Schema.Types.Mixed, // Payload bạn gửi đi
      returnUrlRawQuery: String, // Query string gốc từ returnUrl
      returnUrlVerifiedPayload: mongoose.Schema.Types.Mixed, // Payload đã xác thực từ returnUrl
      ipnRawBody: String, // Body gốc từ IPN
      ipnVerifiedPayload: mongoose.Schema.Types.Mixed, // Payload đã xác thực từ IPN
    },
  },
  {
    timestamps: true,
  }
);

// Generate transaction reference
transactionSchema.pre("save", function (next) {
  if (!this.transaction_reference) {
    const prefix = this.payment_method
      ? this.payment_method.toUpperCase().substring(0, 3)
      : "TRN";
    const timestamp = Date.now().toString(); // Sử dụng timestamp đầy đủ hơn
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    this.transaction_reference = `${prefix}${timestamp.slice(-8)}${random}`;
  }

  // Set expiration cho QR codes (15 phút)
  if (
    !this.expiredAt &&
    (this.payment_method === "vnpay" || this.payment_method === "momo") &&
    this.status === "pending"
  ) {
    this.expiredAt = new Date(Date.now() + 15 * 60 * 1000);
  }

  // Set expiration cho bank transfer (24 giờ)
  if (
    !this.expiredAt &&
    this.payment_method === "bank_transfer" &&
    this.status === "pending"
  ) {
    this.expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  next();
});

// Virtual fields
transactionSchema.virtual("formattedAmount").get(function () {
  return this.amount?.toLocaleString("vi-VN") + " VNĐ";
});

transactionSchema.virtual("isExpired").get(function () {
  return this.expiredAt && new Date() > this.expiredAt;
});

transactionSchema.virtual("statusDisplay").get(function () {
  const statusMap = {
    pending: "Đang chờ",
    processing: "Đang xử lý",
    completed: "Hoàn thành",
    failed: "Thất bại",
    cancelled: "Đã hủy",
    expired: "Hết hạn",
  };
  return statusMap[this.status] || this.status;
});

module.exports = mongoose.model("Transaction", transactionSchema);
