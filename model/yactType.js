const mongoose = require('mongoose');
const { Schema } = mongoose;

const yachTypeSchema = new Schema({
    name: String,
    ranking: Number
});

module.exports = mongoose.model('YachtType', yachTypeSchema);