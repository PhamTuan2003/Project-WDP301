const mongoose = require("mongoose");
const { Schema } = mongoose;

const yachtSchema = new Schema(
  {
    name: String,
    image: String,
    launch: String,
    description: String,
    hullBody: Number,
    rule: Number,
    itinerary: String,
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
    yachtTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "YachtType" },
    IdCompanys: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    isDeleted: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Yacht", yachtSchema, "yachts");
