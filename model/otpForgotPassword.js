const mongoose = require('mongoose');
const { Schema } = mongoose;

const otpForgotPasswordSchema = new Schema({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  otp_code: String,
  expiration_time: Date
});

module.exports = mongoose.model('OtpForgotPassword', otpForgotPasswordSchema);