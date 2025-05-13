const mongoose = require('mongoose');
const { Schema } = mongoose;

const accountSchema = new Schema({
  username: String,
  password: String,
  status: Number
});

module.exports = mongoose.model('Account', accountSchema);