const mongoose = require('mongoose');
const { Schema } = mongoose;

const billSchema = new Schema({
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingOrder' },
  transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  total: Number
});

module.exports = mongoose.model('Bill', billSchema);