// models/paymentSchedule.js
const mongoose = require("mongoose");

const paymentScheduleSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BookingOrder",
      required: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Payment schedule items
    payments: [
      {
        sequenceNumber: {
          type: Number,
          required: true,
        },
        type: {
          type: String,
          enum: ["deposit", "installment", "final", "full"],
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        percentage: {
          type: Number,
          min: 0,
          max: 100,
        },
        dueDate: {
          type: Date,
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "paid", "overdue", "waived"],
          default: "pending",
        },
        paidAt: Date,
        transactionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Transaction",
        },
        remindersSent: [
          {
            sentAt: Date,
            type: String, // "email", "sms", "push"
            status: String, // "sent", "opened", "clicked"
          },
        ],
        notes: String,
      },
    ],

    // Schedule configuration
    configuration: {
      scheduleType: {
        type: String,
        enum: ["standard", "custom", "installment"],
        default: "standard",
      },
      depositPercentage: {
        type: Number,
        default: 20,
        min: 0,
        max: 100,
      },
      numberOfInstallments: {
        type: Number,
        default: 1,
        min: 1,
        max: 12,
      },
      intervalDays: {
        type: Number,
        default: 30,
        min: 1,
      },
      earlyPaymentDiscount: {
        percentage: Number,
        minimumDays: Number,
      },
      latePaymentPenalty: {
        percentage: Number,
        gracePeriodDays: Number,
      },
    },

    // Status tracking
    overallStatus: {
      type: String,
      enum: ["active", "completed", "cancelled", "defaulted"],
      default: "active",
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

    // Auto-reminder settings
    reminderSettings: {
      enabled: { type: Boolean, default: true },
      reminderDays: [7, 3, 1], // Days before due date
      reminderMethods: [String], // ["email", "sms"]
      escalationDays: [7, 14, 30], // Days after due date
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
paymentScheduleSchema.index({ bookingId: 1 });
paymentScheduleSchema.index({ customerId: 1 });
paymentScheduleSchema.index({ "payments.dueDate": 1 });
paymentScheduleSchema.index({ "payments.status": 1 });

// Methods
paymentScheduleSchema.methods.generateStandardSchedule = function () {
  const { depositPercentage } = this.configuration;
  const depositAmount = Math.round(
    (this.totalAmount * depositPercentage) / 100
  );
  const finalAmount = this.totalAmount - depositAmount;

  this.payments = [
    {
      sequenceNumber: 1,
      type: "deposit",
      amount: depositAmount,
      percentage: depositPercentage,
      dueDate: new Date(), // Immediately
      status: "pending",
    },
    {
      sequenceNumber: 2,
      type: "final",
      amount: finalAmount,
      percentage: 100 - depositPercentage,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days later
      status: "pending",
    },
  ];

  this.remainingAmount = this.totalAmount;
};

paymentScheduleSchema.methods.recordPayment = function (
  paymentSequence,
  transactionId,
  amount
) {
  const payment = this.payments.find(
    (p) => p.sequenceNumber === paymentSequence
  );
  if (payment && payment.status === "pending") {
    payment.status = "paid";
    payment.paidAt = new Date();
    payment.transactionId = transactionId;

    this.totalPaid += amount;
    this.remainingAmount = this.totalAmount - this.totalPaid;

    if (this.remainingAmount <= 0) {
      this.overallStatus = "completed";
    }
  }
};

paymentScheduleSchema.methods.getNextDuePayment = function () {
  return this.payments
    .filter((p) => p.status === "pending")
    .sort((a, b) => a.dueDate - b.dueDate)[0];
};

paymentScheduleSchema.methods.getOverduePayments = function () {
  const now = new Date();
  return this.payments.filter((p) => p.status === "pending" && p.dueDate < now);
};

module.exports = mongoose.model("PaymentSchedule", paymentScheduleSchema);
