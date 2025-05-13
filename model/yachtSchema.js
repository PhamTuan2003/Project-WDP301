const mongoose = require('mongoose');
const { Schema } = mongoose;

const yachtSchema = new Schema({
    name: String,
    registration_no: String,
    description: String,
    capacity: Number,
    price: Number,
    yacht_type: { type: mongoose.Schema.Types.ObjectId, ref: 'YachtType' },
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' }
});

module.exports = mongoose.model('Yacht', yachtSchema);