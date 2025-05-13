const mongoose = require('mongoose');
const { Schema } = mongoose;

const roomImageSchema = new Schema({
  room_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  url: String
});

module.exports = mongoose.model('RoomImage', roomImageSchema);