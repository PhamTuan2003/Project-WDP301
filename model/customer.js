const mongoose = require('mongoose');
const { Schema } = mongoose;

const customerSchema = new Schema({
  name: String,
  phone_number: String,
  email: String,
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' }
});

module.exports = mongoose.model('Customer', customerSchema);