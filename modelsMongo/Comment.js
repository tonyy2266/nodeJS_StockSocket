var mongoose = require('mongoose')
const moment = require('moment')
const mongoosePaginate = require('mongoose-paginate-v2')
// const mongoosePaginateAggregate = require('mongoose-aggregate-paginate-v2')

const mongooseLeanVirtuals = require('mongoose-lean-virtuals')

const myPlugins = [mongooseLeanVirtuals, mongoosePaginate]

const schema = new mongoose.Schema({
  idCustomer: String,
  challengeId: Number,
  stockCode: String,
  message: String,
  showHideStatus: {
    type: String,
    enum: ['HIDE', 'SHOW']
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE']
  },
  commentType: {
    type: String,
    enum: ['CHALLENGE', 'STOCK_CODE', 'COMMUNITY']
  },
  catCode: {
    type: String,
    enum: ['BASIC', 'TECHNICAL', 'TRADING', 'STRATEGY']
  },
  tagNames: String, // luu kieu 'VCB,VPB'
  metadata: [String],
  urlImages: [String],
  urlLinks: [String],
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  totalChildren: {
    type: Number,
    default: 0
  },
  totalLikes: {
    type: Number,
    default: 0
  },
  customerLikes: [String],
  totalDislikes: {
    type: Number,
    default: 0
  },
  customerShares: [String],
  totalShares: {
    type: Number,
    default: 0
  },
  customerDisLikes: [String],
  warning: {
    type: Number,
    default: 0
  },
  customerWarnings: [String],
  followIds: [String],
  createdAt: {
    type: Date,
    default: Date.now()
  },
  updatedAt: {
    type: Date,
    default: Date.now()
  },
  requestTime: {
    type: String
  },
  isTop: {
    type: Number,
    default: 0
  }
})

myPlugins.forEach(plugin => schema.plugin(plugin))


module.exports = mongoose.model('Comment', schema)
