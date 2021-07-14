var mongoose = require('mongoose')
const mongoosePaginate = require('mongoose-paginate-v2')

const schema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  stock_exchange: String,
  stock_code: {
    type:String,
    text: true
  },
  ref_price: {
   type: Number,
  },
  ceil_price: Number,
  floor_price: {
   type: Number,
  },
  total_volumn_market: {
   type: Number,
  },
  total_val: {
   type: Number,
  },
  highest_price: {
    type: Number,
  },
  lowest_price: {
    type: Number,
  },
  current_match_price: {
    type: Number,
  },
  last_vol: {
    type: Number,
  },
  last_price: {
    type: Number,
  },
  open_price: {
    type: Number,
  },
  close_price: {
    type: Number,
  },
  avr_price: {
    type: Number,
  },
  change_price: {
    type: Number,
  },
  change_price_percent: {
    type: Number,
  },
  buy_price_1: {
    type: Number,
  },
  buy_volumn_1: {
    type: Number,
  },
  buy_price_2: {
    type: Number,
  },
  buy_price_3: {
    type: Number,
  },
  buy_volumn_3: {
    type: Number,
  },
  sell_price_1: {
    type: Number,
  },
  sell_price_2: {
    type: Number,
  },
  sell_price_3: {
    type: Number,
  },
  sell_volumn_3: {
    type: Number,
  },
  current_room: {
    type: Number,
  },
  foreign_buy_vol: {
    type: Number,
  },
  foreign_sell_vol: {
    type: Number,
  },
  log_date: Number,
  total_room: {
    type: Number,
  },
  total_vol: {
    type: Number,
  },
  list_customer_alert: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'customer_alert' },
  ],
  created_at: String,
  updated_at: String,
})

schema.plugin(mongoosePaginate);
module.exports = mongoose.model('stock_info', schema)
