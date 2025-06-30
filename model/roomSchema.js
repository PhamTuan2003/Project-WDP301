const mongoose = require("mongoose");
const { Schema } = mongoose;

const roomSchema = new Schema({
  name: String,
  description: String,
  area: Number,
  avatar: String,
  roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' },
  yachtId: { type: mongoose.Schema.Types.ObjectId, ref: 'Yacht' }
});

module.exports = mongoose.model('Room', roomSchema, 'rooms');
