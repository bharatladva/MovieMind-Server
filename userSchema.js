const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },

  fireBaseUid: {
    type: String,
    required: true,
  },
  favorites: [
    {
      itemId: Number,
      itemType: String,
    },
  ],
  watchList: [
    {
      itemId: Number,
      itemType: String,
    },
  ],
  ratings: [
    {
      itemId: Number,
      itemType: String,
      rating: { type: Number, required: true },
    },
  ],
});

const User = mongoose.model("users", userSchema);

module.exports = { User };
