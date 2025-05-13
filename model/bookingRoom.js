const mongoose = require('mongoose');
const { Schema } = mongoose;

const bookingRoomSchema = new Schema({
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingOrder' },
  room_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' }
});

module.exports = mongoose.model('BookingRoom', bookingRoomSchema);