const mongoose = require("mongoose");

const bookingOrderSchema = new mongoose.Schema(
  {
    // Existing fields...
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
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // THÊM CÁC FIELDS MỚI
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "rejected",
        "consultation_requested",
      ],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "deposit_paid", "fully_paid"],
      default: "unpaid",
    },
    depositAmount: {
      type: Number,
      default: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
    },
    remainingAmount: {
      type: Number,
      default: 0,
    },
    confirmationCode: {
      type: String,
      unique: true,
    },

    // Existing fields...
    requirements: String,
    guestCount: Number,
    checkInDate: Date,
    cancelledAt: Date,
    confirmedAt: Date,

    // Consultation specific data
    consultationData: {
      requestedRooms: [Object],
      estimatedPrice: Number,
      createdAt: Date,
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

// Generate confirmation code
bookingOrderSchema.pre("save", function (next) {
  if (!this.confirmationCode) {
    this.confirmationCode =
      "BK" +
      Date.now().toString().slice(-8) +
      Math.random().toString(36).substr(2, 4).toUpperCase();
  }

  // Calculate remaining amount
  this.remainingAmount = this.amount - this.totalPaid;

  // Set confirmed timestamp
  if (this.status === "confirmed" && !this.confirmedAt) {
    this.confirmedAt = new Date();
  }

  next();
});

module.exports = mongoose.model("BookingOrder", bookingOrderSchema);
