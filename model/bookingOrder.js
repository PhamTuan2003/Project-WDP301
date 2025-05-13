const mongoose = require('mongoose');
const { Schema } = mongoose;

const bookingOrderSchema = new Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  yacht_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Yacht' },
  schedule_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule' },
  amount: Number,
  status: String,
  create_time: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BookingOrder', bookingOrderSchema);