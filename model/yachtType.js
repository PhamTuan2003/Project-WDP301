const mongoose = require('mongoose');
const { Schema } = mongoose;

const yachTypeSchema = new Schema({
    starRanking: String,
});

module.exports = mongoose.model('YachtType', yachTypeSchema, 'yachtTypes');