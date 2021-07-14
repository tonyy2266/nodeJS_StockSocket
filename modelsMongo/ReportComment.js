var mongoose = require('mongoose')
// const mongoosePaginate = require('mongoose-paginate-v2')
// const mongooseLeanVirtuals = require('mongoose-lean-virtuals')

const schema = new mongoose.Schema({
  idCustomer: String,
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  message: String,
  reportType: {
    type: String,
    enum: ['INAPPROPRIATE','SPAM','PROVOKE','OTHER']
  },
  createdAt: {  
    type: Date,
    default: Date.now()
  },
  updatedAt: {
    type: Date,
    default: Date.now()
  }
})

// schema.plugin(mongoosePaginate)

module.exports = mongoose.model('ReportComment', schema)
