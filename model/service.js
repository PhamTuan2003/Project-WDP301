const mongoose = require('mongoose');
const { Schema } = mongoose;

const serviceSchema = new Schema({
  serviceName: String,
  price: Number
});

module.exports = mongoose.model('Service', serviceSchema, 'services');