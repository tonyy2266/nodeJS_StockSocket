var mongoose = require('mongoose')

const schema = new mongoose.Schema({
  idCustomer: Number,
  idSocket: String,
  channel: String,
  stockCode: String,
  guid: String,
  idCustomerPine: String,
  createdAt: {
    type: Date,
    default: Date.now()
  },
  updatedAt: {
    type: Date,
    default: Date.now()
  }
})

module.exports = mongoose.model('customer_socket_acad', schema)
