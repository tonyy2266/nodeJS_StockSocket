var mongoose = require('mongoose')

const schema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  stock_exchange: String,
  stock_code: String,
  last_prices: [Number],
  trading_date: String,
  updated_at: String
})

module.exports = mongoose.model('stock_report', schema)
