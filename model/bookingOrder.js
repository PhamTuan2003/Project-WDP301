// models/bookingOrder.js
const mongoose = require("mongoose");

const bookingOrderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    customerInfo: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phoneNumber: { type: String, required: true },
      address: String,
      saveForFuture: { type: Boolean, default: true },
    },

    yacht: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Yacht",
      required: true,
    },

    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Schedule",
      default: null,
    },

    // Mã booking tự động sinh
    bookingCode: {
      type: String,
      unique: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "consultation_requested",
        "consultation_sent",
        "pending_payment",
        "confirmed",
        "completed",
        "cancelled",
        "rejected",
      ],
      default: "consultation_requested",
    },

    // Trạng thái consultation riêng biệt
    consultationStatus: {
      type: String,
      enum: ["not_requested", "requested", "sent", "responded"],
      default: "not_requested",
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "deposit_paid", "fully_paid"],
      default: "unpaid",
    },

    // Cải thiện payment breakdown
    paymentBreakdown: {
      totalAmount: { type: Number, default: 0 },
      depositAmount: { type: Number, default: 0 },
      depositPercentage: { type: Number, default: 20 }, // 20%
      remainingAmount: { type: Number, default: 0 },
      totalPaid: { type: Number, default: 0 },
    },

    confirmationCode: {
      type: String,
      unique: true,
      sparse: true,
    },

    requirements: {
      type: String,
      default: "",
    },

    guestCount: {
      type: Number,
      required: true,
      min: 1,
    },

    adults: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    childrenUnder10: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    childrenAbove10: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    checkInDate: {
      type: Date,
      required: true,
    },

    // Tracking timestamps
    consultationRequestedAt: Date,
    consultationSentAt: Date,
    paymentPendingAt: Date,
    cancelledAt: Date,
    confirmedAt: Date,

    // Chi tiết consultation data
    consultationData: {
      requestedRooms: [
        {
          id: { type: String, required: true },
          name: String,
          description: String,
          area: Number,
          avatar: String,
          max_people: Number,
          price: Number,
          quantity: Number,
          beds: Number,
          image: String,
        },
      ],
      estimatedPrice: {
        type: Number,
        min: 0,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      status: {
        type: String,
        enum: ["pending", "contacted", "completed"],
        default: "pending",
      },
      notes: String,
      respondedAt: Date,
      // Thêm thông tin staff xử lý
      assignedStaff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Staff",
      },
      // Priority level
      priority: {
        type: String,
        enum: ["low", "normal", "high", "urgent"],
        default: "normal",
      },
    },

    // Modification history
    modifications: [
      {
        type: {
          type: String,
          enum: [
            "add_room",
            "remove_room",
            "change_guest_count",
            "change_date",
          ],
        },
        originalData: mongoose.Schema.Types.Mixed,
        newData: mongoose.Schema.Types.Mixed,
        additionalCost: { type: Number, default: 0 },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        requestedAt: { type: Date, default: Date.now },
        processedAt: Date,
        processedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Staff",
        },
        notes: String,
      },
    ],

    // Settings
    allowModifications: { type: Boolean, default: true },
    modificationDeadline: Date, // Deadline để modification

    create_time: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware để tạo codes và tính toán
bookingOrderSchema.pre("save", function (next) {
  // Tạo booking code nếu chưa có
  if (!this.bookingCode) {
    const prefix = "BK";
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    this.bookingCode = `${prefix}${timestamp}${random}`;
  }
  if (
    this.isModified("status") &&
    this.status === "confirmed" &&
    !this.confirmationCode
  ) {
    this.confirmationCode =
      "CNF" +
      Date.now().toString().slice(-8) +
      Math.random().toString(36).substr(2, 4).toUpperCase();
    if (!this.confirmedAt) {
      // Chỉ set nếu chưa có
      this.confirmedAt = new Date();
    }
  }

  // Tính toán payment breakdown
  this.paymentBreakdown.totalAmount = this.amount;
  this.paymentBreakdown.depositAmount = Math.round(
    (this.amount * this.paymentBreakdown.depositPercentage) / 100
  );
  this.paymentBreakdown.remainingAmount =
    this.amount - this.paymentBreakdown.totalPaid;

  // Set modification deadline (7 days before check-in)
  if (
    !this.modificationDeadline &&
    this.checkInDate &&
    this.status === "confirmed"
  ) {
    this.modificationDeadline = new Date(
      this.checkInDate.getTime() - 7 * 24 * 60 * 60 * 1000
    );
  }

  // Set timestamps dựa trên thay đổi trạng thái
  if (this.isModified("status")) {
    if (this.status === "pending_payment" && !this.paymentPendingAt) {
      this.paymentPendingAt = new Date();
    }
    if (this.status === "cancelled" && !this.cancelledAt) {
      this.cancelledAt = new Date();
    }
  }

  if (this.isModified("consultationStatus")) {
    if (
      this.consultationStatus === "requested" &&
      !this.consultationRequestedAt
    ) {
      this.consultationRequestedAt = new Date();
    }
    if (this.consultationStatus === "sent" && !this.consultationSentAt) {
      this.consultationSentAt = new Date();
    }
  }
  next();
});

// Virtual fields
bookingOrderSchema.virtual("canModify").get(function () {
  return (
    this.allowModifications &&
    this.modificationDeadline &&
    new Date() < this.modificationDeadline &&
    ["confirmed"].includes(this.status)
  );
});

bookingOrderSchema.virtual("formattedAmount").get(function () {
  return this.amount?.toLocaleString("vi-VN") + " VNĐ";
});

module.exports = mongoose.model(
  "BookingOrder",
  bookingOrderSchema,
  "bookingOrders"
);
