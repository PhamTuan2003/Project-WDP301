const mongoose = require('mongoose');
const { Schema } = mongoose;

const transactionSchema = new Schema({
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingOrder' },
  transaction_date: Date,
  sender_bank_no: String,
  receiver_bank_no: String
});

module.exports = mongoose.model('Transaction', transactionSchema);