var mongoose = require('mongoose')
const Schema = mongoose.Schema;

const schema = new mongoose.Schema({
  _id: Schema.Types.ObjectId,
  market_status: String,
  stock_exchange: String
})

module.exports = mongoose.model('market_status', schema)
