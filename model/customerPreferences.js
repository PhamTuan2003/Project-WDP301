// models/customerPreferences.js
const mongoose = require("mongoose");

const customerPreferencesSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      unique: true,
    },

    // Thông tin để auto-fill forms
    bookingPreferences: {
      preferredName: String,
      preferredEmail: String,
      preferredPhone: String,
      preferredAddress: String,

      // Preferences for booking
      commonRequirements: [String], // Các yêu cầu thường dùng
      preferredGuestCount: Number,
      preferredRoomTypes: [String],
      preferredYachtTypes: [String],

      // Budget preferences
      preferredBudgetRange: {
        min: Number,
        max: Number,
      },

      // Timing preferences
      preferredCheckInTimes: [String], // ["morning", "afternoon", "evening"]
      preferredDurations: [Number], // [1, 2, 3] days
      preferredSeasons: [String], // ["spring", "summer", "autumn", "winter"]
    },

    // Lịch sử consultation
    consultationHistory: [
      {
        bookingId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BookingOrder",
        },
        requestedAt: Date,
        respondedAt: Date,
        status: {
          type: String,
          enum: ["requested", "sent", "responded", "ignored", "converted"],
        },
        responseTime: Number, // minutes
        notes: String,
        rating: Number, // Customer rating của consultation
        convertedToBooking: { type: Boolean, default: false },
      },
    ],

    // Communication preferences
    communications: {
      emailNotifications: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: false },
      promotionalEmails: { type: Boolean, default: true },
      reminderNotifications: { type: Boolean, default: true },

      // Preferred contact methods
      preferredContactMethod: {
        type: String,
        enum: ["email", "phone", "sms", "whatsapp"],
        default: "email",
      },
      preferredContactTime: {
        type: String,
        enum: ["morning", "afternoon", "evening", "anytime"],
        default: "anytime",
      },
    },

    // Customer behavior analytics
    behavior: {
      totalBookings: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 },
      averageBookingValue: { type: Number, default: 0 },
      lastBookingDate: Date,
      bookingFrequency: String, // "frequent", "occasional", "rare"

      // Loyalty metrics
      loyaltyLevel: {
        type: String,
        enum: ["bronze", "silver", "gold", "platinum"],
        default: "bronze",
      },
      loyaltyPoints: { type: Number, default: 0 },

      // Preferences based on history
      favoriteYachts: [
        {
          yachtId: { type: mongoose.Schema.Types.ObjectId, ref: "Yacht" },
          bookingCount: Number,
          lastBooked: Date,
        },
      ],
      favoriteRooms: [String],
      mostUsedServices: [String],
    },

    // Saved payment methods (encrypted)
    savedPaymentMethods: [
      {
        type: {
          type: String,
          enum: ["card", "bank_account"],
        },
        isDefault: { type: Boolean, default: false },
        lastUsed: Date,
        // Không lưu thông tin nhạy cảm, chỉ token từ gateway
        token: String,
        maskedInfo: String, // VD: "**** **** **** 1234"
        expiryDate: String,
        addedAt: { type: Date, default: Date.now },
      },
    ],

    // Marketing segments
    marketing: {
      segments: [String], // ["high_value", "frequent_booker", "luxury_seeker"]
      campaigns: [
        {
          campaignId: String,
          joinedAt: Date,
          status: String, // "active", "completed", "opted_out"
        },
      ],
      leadSource: String, // "google", "facebook", "referral", etc.
      referralCode: String,
      referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
      },
    },

    // Privacy settings
    privacy: {
      shareDataForMarketing: { type: Boolean, default: false },
      shareDataForAnalytics: { type: Boolean, default: true },
      allowThirdPartyIntegration: { type: Boolean, default: false },
      dataRetentionPeriod: { type: Number, default: 365 }, // days
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
customerPreferencesSchema.index({ customerId: 1 });
customerPreferencesSchema.index({ "behavior.loyaltyLevel": 1 });
customerPreferencesSchema.index({ "marketing.segments": 1 });

// Methods
customerPreferencesSchema.methods.updateLoyaltyLevel = function () {
  const totalSpent = this.behavior.totalSpent;

  if (totalSpent >= 50000000) {
    // 50M VND
    this.behavior.loyaltyLevel = "platinum";
  } else if (totalSpent >= 20000000) {
    // 20M VND
    this.behavior.loyaltyLevel = "gold";
  } else if (totalSpent >= 5000000) {
    // 5M VND
    this.behavior.loyaltyLevel = "silver";
  } else {
    this.behavior.loyaltyLevel = "bronze";
  }
};

customerPreferencesSchema.methods.addConsultationHistory = function (
  consultationData
) {
  this.consultationHistory.push(consultationData);

  // Keep only last 20 consultations
  if (this.consultationHistory.length > 20) {
    this.consultationHistory = this.consultationHistory.slice(-20);
  }
};

module.exports = mongoose.model(
  "CustomerPreferences",
  customerPreferencesSchema
);
