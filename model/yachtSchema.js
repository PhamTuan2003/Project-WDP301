const mongoose = require('mongoose');
const { Schema } = mongoose;

const yachtSchema = new Schema({
    name: String,
    image: String,
    launch: String,
    description: String,
    hullBody: Number,
    rule: Number,
    itinerary: String,
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    yachtTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'YachtType' },
    IdCompanys: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: true },
});

module.exports = mongoose.model('Yacht', yachtSchema, 'yachts');