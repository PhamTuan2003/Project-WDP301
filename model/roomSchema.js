const mongoose = require('mongoose');
const { Schema } = mongoose;

const roomSchema = new Schema({
  name: String,
  description: String,
  area: Number,
  max_people: Number,
  room_type: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' },
  yacht_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Yacht' }
});

module.exports = mongoose.model('Room', roomSchema);