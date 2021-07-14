var mongoose = require('mongoose')
const mongoosePaginate = require('mongoose-paginate-v2')
// const mongooseLeanVirtuals = require('mongoose-lean-virtuals')

const schema = new mongoose.Schema({
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  tagName: String,
  createdAt: {  
    type: Date,
    default: Date.now()
  },
  updatedAt: {
    type: Date,
    default: Date.now()
  }
})

schema.plugin(mongoosePaginate)

module.exports = mongoose.model('Hastag', schema)
