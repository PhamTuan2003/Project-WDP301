const mongoose = require('mongoose');
const { Schema } = mongoose;

const yachtScheduleSchema = new Schema({
  yacht_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Yacht' },
  schedule_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule' }
});

module.exports = mongoose.model('YachtSchedule', yachtScheduleSchema);