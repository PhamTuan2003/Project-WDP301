const mongoose = require('mongoose');
const { Schema } = mongoose;

const roomTypeSchema = new Schema({
  name: String,
  price: Number
});

module.exports = mongoose.model('RoomType', roomTypeSchema);