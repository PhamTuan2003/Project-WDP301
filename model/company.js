const mongoose = require('mongoose');
const { Schema } = mongoose;

const companySchema = new Schema({
  name: String,
  address: String,
  email: String,
  phone: String,
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' }
});

module.exports = mongoose.model('Company', companySchema);