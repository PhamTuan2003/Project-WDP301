const mongoose = require('mongoose');
const { Schema } = mongoose;

const feedbackSchema = new Schema({
  rating: Number,
  description: String,
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  yacht_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Yacht' }
});

module.exports = mongoose.model('Feedback', feedbackSchema);