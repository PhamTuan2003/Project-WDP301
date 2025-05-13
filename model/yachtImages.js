const mongoose = require('mongoose');
const { Schema } = mongoose;

const yachtImageSchema = new Schema({
    yacht_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Yacht' },
    url: String
});

module.exports = mongoose.model('YachtImage', yachtImageSchema);