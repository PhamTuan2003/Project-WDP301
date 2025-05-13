const mongoose = require('mongoose');
const { Schema } = mongoose;

const scheduleSchema = new Schema({
  name: String,
  start_date: Date,
  end_date: Date
});

module.exports = mongoose.model('Schedule', scheduleSchema);