const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  telegram_id: { type: Number, required: true, unique: true },
  username: { type: String, default: null },
  first_name: { type: String },
  started_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
