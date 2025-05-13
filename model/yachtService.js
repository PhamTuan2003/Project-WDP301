const mongoose = require('mongoose');
const { Schema } = mongoose;

const yachtServiceSchema = new Schema({
  yacht_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Yacht' },
  service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' }
});

module.exports = mongoose.model('YachtService', yachtServiceSchema);