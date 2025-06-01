const mongoose = require("mongoose");

const bookingOrderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
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
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        "consultation_requested",
        "confirmed",
        "completed",
        "cancelled",
        "rejected",
      ],
      default: "consultation_requested",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "deposit_paid", "fully_paid"],
      default: "unpaid",
    },
    depositAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    confirmationCode: {
      type: String,
      unique: true,
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
    checkInDate: {
      type: Date,
      required: true,
    },
    cancelledAt: {
      type: Date,
    },
    confirmedAt: {
      type: Date,
    },
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
    },
    create_time: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware để xử lý trước khi lưu
bookingOrderSchema.pre("save", function (next) {
  // Tạo confirmationCode nếu chưa có
  if (!this.confirmationCode) {
    this.confirmationCode =
      "BK" +
      Date.now().toString().slice(-8) +
      Math.random().toString(36).substr(2, 4).toUpperCase();
  }

  // Tính remainingAmount
  this.remainingAmount = this.amount - this.totalPaid;

  // Đặt confirmedAt khi trạng thái chuyển sang confirmed
  if (this.status === "confirmed" && !this.confirmedAt) {
    this.confirmedAt = new Date();
  }

  // Đặt cancelledAt khi trạng thái chuyển sang cancelled
  if (this.status === "cancelled" && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }

  next();
});

module.exports = mongoose.model("BookingOrder", bookingOrderSchema);
