const mongoose = require('mongoose');
const { Schema } = mongoose;

const bookingServiceSchema = new Schema({
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingOrder' },
  service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' }
});

module.exports = mongoose.model('BookingService', bookingServiceSchema);