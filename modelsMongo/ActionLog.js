var mongoose = require('mongoose')
const mongoosePaginate = require('mongoose-paginate-v2')

const schema = new mongoose.Schema({
  idCustomer: String,
  actionCode: String,
  actionType: {
    type:String,
    enum:['CHALLENGE', 'STOCK_CODE', 'COMMUNITY']
  },
  totalCount: {
    type: Number,
    default: 0
  },
  targetId: String,
  duration: Number,
  createdAt: String,
  updatedAt: String
})

schema.plugin(mongoosePaginate)

module.exports = mongoose.model('ActionLog', schema)
