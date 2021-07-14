const express = require('express')
const bodyParser = require('body-parser')
const moment = require('moment')
const Sequelize = require('sequelize')
const Op = Sequelize.Op
const config = require('../../../config')
const cf = require('../../../helpers/CF')
const AuthMiddleware = require('../../AuthMiddleware')
const ResponseCode = require('../../../ResponseCode')
const models = require('../../../models')
var request = require('request-promise');
var SolrNode = require('solr-node')
var accents = require('remove-accents')
var TraddingService = require('../../../socket/TraddingService')
var solrClient = new SolrNode(config.solrOptions)
const CustomerSocketAcad = require('../../../modelsMongo/CustomerSocketAcad')
const ActionLog = require('../../../modelsMongo/ActionLog')
const Comment = require('../../../modelsMongo/Comment')
const ReportComment = require('../../../modelsMongo/ReportComment')
const Hashtag = require('../../../modelsMongo/Hastag')
const { result } = require('lodash')
const mongoose = require('mongoose')

const router = express.Router()
router.use(bodyParser.json());

router.get('/public/tradding-deal', AuthMiddleware.authenticateMiddleCustomer, async (req, res) => {
  let test = await models.CustomerSocket.count({ where: { idCustomer: 2 } })
  request('https://api.vietstock.vn/ctd/deal', function (error, response, body) {
    // console.log('error:', error); // Print the error if one occurred
    // console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
    // console.log('body:', body); // Print the HTML for the Google homepage.
    res.status(200).send(cf.buildResponseObject({
      code: ResponseCode.SUCCESS,
      data: JSON.parse(body)
    }))
  });
})


router.get('/public/stock-info-trading', async (req, res) => {
  let stockCode = req.query.stockCode
  let lsStockDataHOSE = await TraddingService.getListInfoReportStockByStockExchange(stockCode)
  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data: lsStockDataHOSE
  }))
})

router.get('/public/import-solr', async (req, res) => {
  let stock_exchange = req.query.stockExchange
  var solrClientTrading = new SolrNode(config.solrStockInfoTradingOptions)
  let log_date = moment().valueOf()
  let lsStockData = await TraddingService.getListInfoReportStockByStockExchange(stock_exchange)
  if (lsStockData) {
    for (let i = 0; i < lsStockData.length; i++) {
      const element = lsStockData[i];
      try {
        const result = solrClientTrading.update(element);
      } catch (e) {
        console.log(e)
        console.error(element.stock_code)
      }
    }
  }

  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data: lsStockData
  }))
})

router.get('/public/import-all-stock-solr', async (req, res) => {
  // await TraddingService.importToSolrAllStockInfor()
  await TraddingService.importToSolrAllStockInfor()

  // const { host, port, core } = config.client_stock_trading_info
  // await request(`http://${host}:${port}/solr/admin/cores?action=RELOAD&core=${core}`)
  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success'
  }))
})



router.get('/public/find-by-stock-code', async (req, res) => {
  let stockCode = req.query.stockCode
  let data = await TraddingService.findSimpleDetailInforByStockCode(stockCode)
  res.status(200).send(data || {})
  // res.status(200).send(cf.buildResponseObject({
  //   code: ResponseCode.SUCCESS,
  //   message: 'Request Success',
  //   data
  // }))
})

router.get('/public/find-by-list-stock-code', async (req, res) => {
  let stockCodes = req.query.stockCodes
  let data = await TraddingService.findSimpleListDetailInforByListStockCode(stockCodes.split('-'))
  res.status(200).send(data || [])
  // res.status(200).send(cf.buildResponseObject({
  //   code: ResponseCode.SUCCESS,
  //   message: 'Request Success',
  //   data
  // }))
})

router.get('/public/find-last-price-by-stock-codes', async (req, res) => {

  let data = await TraddingService.mongoFindStockCodes(req.query.stockCodes)

  res.status(200).send(data || [])
})


router.get('/public/search-company', async (req, res) => {
  let bodyInput = req.query

  let name = ''
  if (bodyInput.name) {
    name = accents.remove(bodyInput.name)
  }

  let page = bodyInput.page != null ? parseInt(bodyInput.page) : 1
  let pageSize = bodyInput.pageSize != null ? parseInt(bodyInput.pageSize) : config.page_limit
  const offset = (parseInt(page) - 1) * pageSize

  let strQuery = ''
  if (name) {
    strQuery = `q=(name:${name} OR code:${name.toUpperCase()} OR stock_exchange:${name.toUpperCase()})&rows=${pageSize}&start=${offset}`
  } else {
    strQuery = `q=*:*&rows=${pageSize}&start=${offset}`
  }


  solrClient.search(strQuery, function (err, result) {
    if (err) {
      return res.status(400).send(cf.buildResponseObject({
        code: ResponseCode.ERROR,
        message: 'Error not found'
      }))
    }
    let response = result.response
    let totalElements = response.numFound
    let totalPages = 0
    let lsData = []

    if (totalElements > 0) {
      if (totalElements % pageSize > 0) {
        totalPages = Math.floor(totalElements / pageSize) + 1;
      } else {
        totalPages = Math.floor(totalElements / pageSize);
      }

      for (let i = 0; i < response.docs.length; i++) {
        const element = response.docs[i];
        lsData.push({ stock_code: element.code, stock_exchange: element.stock_exchange, name: element.name && element.name.length > 0 ? element.name[0] : '' })
      }
    }

    let data = { totalPages, totalElements, page, pageSize, data: lsData }
    res.status(200).send(cf.buildResponseObject({
      code: ResponseCode.SUCCESS,
      message: 'Request Success',
      data
    }))
  })
})

// router.get('/public/test-socket-import-report', async (req, res) => {
//   let data = await TraddingService.importToSolrReportStock()
//   // const { host, port, core } = config.client_stock_trading_report_watchlist
//   // const test = await request(`http://${host}:${port}/solr/admin/cores?action=RELOAD&core=${core}`)
//   res.status(200).send(cf.buildResponseObject({
//     code: ResponseCode.SUCCESS,
//     message: 'Request Success'
//   }))
// })

router.get('/public/test-socket-import-market-index', async (req, res) => {
  let data = await TraddingService.importAllMarketIndex()

  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success'
  }))
})



// router.get('/public/find-report-stock-code', async (req, res) => {
//   let data = await TraddingService.findReportByStockCode(req.query.stock_code)
//   res.status(200).send(cf.buildResponseObject({
//     code: ResponseCode.SUCCESS,
//     message: 'Request Success',
//     data
//   }))
// })


router.get('/public/find-market-index', async (req, res) => {
  let data = await TraddingService.getDataMarketIndex()
  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data
  }))
})

// router.get('/public/test-delete-trading-report', async (req, res) => {
//   await TraddingService.deleteStockReportTradingInfoOverMinutes()
//   res.status(200).send(cf.buildResponseObject({
//     code: ResponseCode.SUCCESS,
//     message: 'Request Success',
//   }))
// })

router.get('/public/test-portfolios', async (req, res) => {
  let data = await TraddingService.getDataPortfolios(req.app.locals.sequelize, req.query.idCustomer)
  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data
  }))
})


router.get('/public/test-socket', async (req, res) => {
  console.log('chay channel');
  let lsCustomerSockets = await CustomerSocketAcad.find({ channel: 'serverSendPortfolios' })

  // var sequelize = app.locals.sequelize
  // let lsCustomerSockets = await models.CustomerSocket.findAll({
  //   where: {
  //     deletedAt: {
  //       [Op.eq]: null
  //     },
  //     channel: {
  //       [Op.eq]: 'serverSendPortfolios'
  //     }
  //   }
  // })

  // console.log(lsCustomerSockets);
  if (lsCustomerSockets && lsCustomerSockets.length > 0) {
    let lsData = []

    for (let i = 0; i < lsCustomerSockets.length; i++) {
      const element = lsCustomerSockets[i];
      // console.log(element);

      let channel = element.channel
      let idSocket = element.idSocket
      let idCustomer = element.idCustomer

      if (!channel || !idSocket || !idCustomer) {
        console.log('empty channel or idSocket');
        continue
      }

      // if (channel === 'serverSendInfoStock') {
      //   if (!element.stockCode) {
      //     continue
      //   }
      //   let data = await TraddingService.getDataByDateAndStockCodes(sequelize, element.stockCode, idCustomer)
      //   console.log('+++++++++++++++++++bat dau chay job channel serverSendInfoStock ++++++++++++++++++++');
      //   // io.to(idSocket).emit(element.channel, {
      //   //   data
      //   // })
      // } else if (channel === 'serverSendPortfolios') {
      //   // let data = await TraddingService.getDataPortfolios(sequelize, idCustomer)
      //   console.log('+++++++++++++++++++bat dau chay job channel serverSendPortfolios ++++++++++++++++++++');
      //   // io.to(idSocket).emit('serverSendPortfolios', {
      //   //   data
      //   // })
      // } else
      if (channel === 'serverSendWatchList') {
        let data = await TraddingService.getDataWatchList(sequelize, idCustomer)
        lsData.push(data)
        console.log('+++++++++++++++++++bat dau chay job channel serverSendWatchList ++++++++++++++++++++');
        // io.to(idSocket).emit('serverSendWatchList', {
        //   data
        // })
      }
    }
    res.status(200).send(cf.buildResponseObject({
      code: ResponseCode.SUCCESS,
      message: 'Request Success',
      data: lsData
    }))

    // send market index
    // io.emit('serverSendMarketIndex', {
    //   data: await tradingService.getDataMarketIndex()
    // })
  }
})

// const memoized = memoize(TraddingService.findOrderTemplate, { async: true, maxAge: 10000 })

router.get('/public/find-order-type-template', async (req, res) => {
  const data = await TraddingService.findOrderTypesTemplates()

  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data
  }))
})

router.get('/public/find-order-type-by-stock-change', async (req, res) => {
  const data = await TraddingService.findOrderTypesConfig()

  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data
  }))
})

router.get('/public/find-order-type-by-stock-code', async (req, res) => {
  var sequelize = req.app.locals.sequelize
  const data = await TraddingService.getDataByDateAndStockCodes(sequelize, req.query.stockCode, req.query.idCustomer)

  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data
  }))
})

router.get('/public/find-order-type-by-stock-code-pine', async (req, res) => {
  var sequelize = req.app.locals.sequelize
  const data = await TraddingService.getDataByDateAndStockCodesPine(sequelize, req.query.stockCode)

  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data
  }))
})

router.get('/public/find-portfios-by-customer', async (req, res) => {
  var sequelize = req.app.locals.sequelize
  const data = await TraddingService.getDataPortfolios(sequelize, req.query.idCustomer)

  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data
  }))
})


router.get('/public/importCompany', async (req, res) => {
  var sequelize = req.app.locals.sequelize
  var sequelizeAcad = req.app.locals.sequelizeAcad
  const data = await TraddingService.importCompany(sequelize, sequelizeAcad)

  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data
  }))
})


router.get('/public/import-all-stock-solr-goline', async (req, res) => {
  // await TraddingService.importToSolrAllStockInfor()
  let data = await TraddingService.importToSolrAllStockInforGoline()

  // const { host, port, core } = config.client_stock_trading_info
  // await request(`http://${host}:${port}/solr/admin/cores?action=RELOAD&core=${core}`)
  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data
  }))
})

router.get('/public/test-socket-import-market-index-goline', async (req, res) => {
  let data = await TraddingService.importAllMarketIndex(true)

  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success'
  }))
})

router.get('/public/import-stock-exchange-status', async (req, res) => {

  await TraddingService.importDefaultMarketStatus()

  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success'
  }))
})

router.get('/public/import-all-data', async (req, res) => {
  // await TraddingService.importAllMarketIndex(true)
  await TraddingService.importToSolrAllStockInforGoline()
  await TraddingService.importDefaultMarketStatus()

  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success'
  }))
})

router.get('/public/find-stock-exchange', async (req, res) => {
  // await TraddingService.importAllMarketIndex(true)
  let data = await TraddingService.findOrderTypeByStockExchange('HOSE')
  // await TraddingService.importDefaultMarketStatus()

  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data
  }))
})

router.get('/public/test-import-socket', async (req, res) => {
  CustomerSocketAcad.findOneAndUpdate({ idCustomer: '2222', channel: 'serverSendPortfolios' }, {
    idCustomer: socket.idCustomer,
    channel: 'serverSendPortfolios',
    idSocket: socket.id
  }, { upsert: true }, (err) => {
    if (err) throw err
    console.log('=============them market thanh cong');
  })

  res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data
  }))
})

router.post('/public/save-action-log', async (req, res) => {
  let body = req.body
  if (!body.idCustomer) {
    return res.status(400).send(cf.buildResponseObject({
      code: ResponseCode.ERROR,
      message: 'IdCustomer not empty'
    }))
  } else if (!body.actionCode) {
    return res.status(400).send(cf.buildResponseObject({
      code: ResponseCode.ERROR,
      message: 'ActionCode Customer not empty'
    }))
  } else if (!body.actionType) {
    return res.status(400).send(cf.buildResponseObject({
      code: ResponseCode.ERROR,
      message: 'ActionType not empty'
    }))
  } else if (!body.targetId) {
    return res.status(400).send(cf.buildResponseObject({
      code: ResponseCode.ERROR,
      message: 'TargetId not empty'
    }))
  }

  let sysdate = moment().format('YYYY-MM-DD hh:mm:ss')

  let query = {
    idCustomer: body.idCustomer,
    actionCode: body.actionCode,
    actionType: body.actionType,
    targetId: body.targetId,
    duration: body.duration || -1
  }

  let countExistLog = await ActionLog.countDocuments(query)

  if (countExistLog > 0) {
    ActionLog.updateOne(query, { $inc: { totalCount: 1 }, updatedAt: sysdate }, (err) => {
      if (err) throw err
      return res.status(200).send(cf.buildResponseObject({
        code: ResponseCode.SUCCESS,
        message: 'Request Success'
      }))
    })
  } else {
    ActionLog.create({
      ...query,
      createdAt: sysdate,
      updatedAt: sysdate
    }, (err) => {
      if (err) throw err
      return res.status(200).send(cf.buildResponseObject({
        code: ResponseCode.SUCCESS,
        message: 'Request Success'
      }))
    })
  }

})

router.get('/public/find-action-log', async (req, res) => {
  let { page, pageSize, actionType, idCustomer, actionCode } = req.query

  pageSize = pageSize ? _.toNumber(pageSize) : 10
  let offset = page ? (_.toNumber(page) - 1) * pageSize : 0
  let query = {}
  if (actionType) query.actionType = actionType
  if (idCustomer) query.idCustomer = idCustomer
  if (actionCode) query.actionCode = actionCode

  var options = {
    sort: { createdAt: 1 },
    lean: true,
    offset,
    select: '-__v',
    limit: pageSize

  }
  let datas = await ActionLog.paginate(query, options)
  return res.status(200).send({ message: 'Request Success', data: datas })
})


const validateComment = (req, res, next) => {
  let body = req.body
  if (!body.commentId) {
    if (!body.idCustomer) {
      return res.status(400).send(cf.buildResponseObject({
        code: ResponseCode.ERROR,
        message: 'IdCustomer is not empty'
      }))
    } else if (!body.commentType) {
      return res.status(400).send(cf.buildResponseObject({
        code: ResponseCode.ERROR,
        message: 'CommentType is invalid'
      }))
    } else if (body.commentType === 'COMMUNITY' && !body.catCode && !body.parentId && !body.stockCode) {
      return res.status(400).send(cf.buildResponseObject({
        code: ResponseCode.ERROR,
        message: 'Catcode is not empty'
      }))
    }
  }
  next()
}

router.post('/public/save-comment', validateComment, async (req, res) => {
  let body = req.body
  let updateData = {}
  if (body.idCustomer) {
    updateData.idCustomer = body.idCustomer
  }
  if (body.challengeId) {
    updateData.challengeId = body.challengeId
  }
  if (body.stockCode) {
    updateData.stockCode = body.stockCode
  }
  if (body.message) {
    updateData.message = body.message
  }
  if (body.showHideStatus) {
    updateData.showHideStatus = body.showHideStatus
  }
  if (body.status) {
    updateData.status = body.status
  }
  if (body.commentType) {
    updateData.commentType = body.commentType
  }
  if (body.catCode) {
    updateData.catCode = body.catCode
  }
  if (body.tagNames) {
    updateData.tagNames = body.tagNames
  }
  if (body.metadata) {
    updateData.metadata = body.metadata
  }
  if (body.urlImages) {
    updateData.urlImages = body.urlImages
  }
  if (body.urlLinks) {
    updateData.urlLinks = body.urlLinks
  }
  if (body.parentId) {
    updateData.parent = body.parentId
    let countParent = await Comment.count({ _id: body.parentId })
    if (countParent === 0) {
      return res.status(400).send({
        message: 'Not found parrent'
      })
    }
  } else {
    updateData.totalChildren = 0
  }
  if (body.isTop) {
    updateData.isTop = body.isTop
  }
  updateData.requestTime = new Date()
  updateData.updatedAt = Date.now()
  updateData.createdAt = Date.now()
  let commentDB
  let commentId
  if (!body.commentId) {
    updateData.status = 'ACTIVE'
    updateData.showHideStatus = 'SHOW'

    // nguoi dung trong list dang bai la hien thi luon
    // if (body.idCustomer && (body.idCustomer == 31 || body.idCustomer == 10834 || body.idCustomer == 54163 || body.idCustomer == 10530 || body.idCustomer == 143 || body.idCustomer == 144 || body.idCustomer == 7542 || body.idCustomer == 21136)) {
    //   updateData.showHideStatus = 'SHOW'
    // }

    if (!body.parentId && body.idCustomer) {
      updateData.followIds = [body.idCustomer]
    }
    // updateData.showHideStatus = body.commentType === 'COMMUNITY' && !body.parentId ? 'HIDE' : 'SHOW'
    commentDB = await Comment.create(updateData)
    commentId = commentDB._id
    if (body.parentId) {
      let commentParent = { $inc: { totalChildren: 1 }, $push: { children: commentId }, updatedAt: Date.now() }
      await Comment.findByIdAndUpdate(body.parentId, commentParent).select('-__v')
    }
  } else {
    updateData.updatedAt = Date.now()
    commentDB = await Comment.findOneAndUpdate({ _id: body.commentId }, updateData).select('-__v')
    commentId = commentDB._id
  }


  if (body.tagNames) {
    // remove all hastag with current comment
    await Hashtag.deleteMany({ comment: commentId })

    let tagNames = body.tagNames.split(',')
    for (let i = 0; i < tagNames.length; i++) {
      const tag = tagNames[i]
      let create = await Hashtag.create({ comment: commentId, tagName: tag })
    }
  }
  return res.status(200).send({ message: 'Request Success', data: commentDB })
})

router.put('/public/like-comment/:commentId', async (req, res) => {
  let commentId = req.params.commentId
  let body = req.body

  let comment = await Comment.findById(commentId)

  if (!comment) {
    return res.status(400).send({ message: 'Not existed comment' })
  }
  let totalLikes = comment.totalLikes || 0
  let updateData = { totalLikes: ++totalLikes }
  if (body && body.idCustomer) {
    updateData.$push = { customerLikes: body.idCustomer }
  }
  let updateComment = await Comment.findByIdAndUpdate(commentId, updateData)
  return res.status(200).send({ message: 'Request Success' })
})

router.put('/public/unlike-comment/:commentId', async (req, res) => {
  let commentId = req.params.commentId
  let body = req.body

  let comment = await Comment.findById(commentId)

  if (!comment) {
    return res.status(400).send({ message: 'Not existed comment' })
  }
  let totalLikes = comment.totalLikes || 0
  let updateData = { totalLikes: --totalLikes }
  if (body && body.idCustomer) {
    updateData.$pull = { customerLikes: body.idCustomer }
  }
  let updateComment = await Comment.findByIdAndUpdate(commentId, updateData)
  return res.status(200).send({ message: 'Request Success' })
})

router.put('/public/dislike-comment/:commentId', async (req, res) => {
  let commentId = req.params.commentId

  let comment = await Comment.findById(commentId)

  if (!comment) {
    return res.status(400).send({ message: 'Not existed comment' })
  }
  let totalDislikes = comment.totalDislikes || 0
  let updateData = { totalDislikes: ++totalDislikes }
  if (body && body.idCustomer) {
    updateData.$push = { customerDisLikes: body.idCustomer }
  }
  let updateComment = await Comment.findByIdAndUpdate(commentId, updateData)
  return res.status(200).send({ message: 'Request Success' })
})

router.put('/public/share-topic/:topicId', async (req, res) => {
  let topicId = req.params.topicId
  let body = req.body

  let comment = await Comment.findById(topicId)

  if (!comment) {
    return res.status(400).send({ message: 'Not existed comment' })
  }
  let totalShare = comment.totalShares || 0
  let updateData = { totalShares: ++totalShare }
  if (body && body.idCustomer) {
    updateData.$push = { customerShares: body.idCustomer }
  }
  let updateComment = await Comment.findByIdAndUpdate(topicId, updateData)
  return res.status(200).send({ message: 'Request Success' })
})

const validateReportComment = (req, res, next) => {
  let { idCustomer, reportType } = req.body
  let commentId = req.params.commentId
  if (!idCustomer) {
    return res.status(400).send({ message: 'IdCustomer is not empty' })
  } else if (!reportType) {
    return res.status(400).send({ message: 'ReportType is not empty' })
  } else if (!commentId) {
    return res.status(400).send({ message: 'CommentId is not empty' })
  }
  next()
}

router.put('/public/report-comment/:commentId', validateReportComment, async (req, res) => {
  let commentId = req.params.commentId
  let { idCustomer, reportType, message, totalWarning } = req.body

  let comment = await Comment.findById(commentId)

  if (!comment) {
    return res.status(400).send({ message: 'Not existed comment' })
  }
  let warning = (comment.warning || 0) + totalWarning
  let updateComment = await Comment.findByIdAndUpdate(commentId, { warning: ++warning, $push: { customerWarnings: idCustomer } })

  if (updateComment.warning >= 3 && comment.parent) {
    let commentParent = { $inc: { totalChildren: -1 } }
    await Comment.findByIdAndUpdate(comment.parent, commentParent)
  }

  // add new report comment
  let inserReport = await ReportComment.create({
    idCustomer: idCustomer,
    comment: commentId,
    message,
    reportType
  })

  // send mail report
  return res.status(200).send({ message: 'Report Success' })
})

router.post('/public/find-exciting-comments', async (req, res) => {

  let { next, limit, showHideStatus, isWeb } = req.body
  limit = 20
  showHideStatus = showHideStatus || 'SHOW'

  let where = { commentType: 'COMMUNITY', status: 'ACTIVE', showHideStatus, parent: { $exists: false } }
  where.warning = { $lt: 3 } // report 3 tro len an di

  let result = []
  if (next) {
    const [nextTotalComments, nextId] = next.split('_')
    where.$or = [
      { totalChildren: { $lt: nextTotalComments } },
      { totalChildren: nextTotalComments, _id: { $lt: nextId } }
    ]
  }
  if (isWeb && next) {
    where.$or.push({ urlImages: { $ne: null } })
    where.$or.push({ urlLinks: { $ne: null } })
  } else if (isWeb) {
    where.$or = [
      { $and: [{ urlImages: { $ne: null } }, { urlImages: { $ne: [] } }] },
      { $and: [{ urlLinks: { $ne: null } }, { urlLinks: { $ne: [] } }] }
    ]
  }
  // Add dk cho các bài gần đây lên trước 
  let fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - 7)
  where.createdAt = { $gt: fromDate }


  result = await Comment.find(where).select('-__v -parent').lean({ virtuals: true })
    .sort({ totalChildren: -1, totalLikes: -1, totalShares: -1, _id: -1 }).limit(limit)

  // Nếu chưa đủ 20 topic thì lấy thêm các bài gần nhất 
  if (result.length < limit) {
    where.createdAt = { $lt: fromDate }
    let limit2 = limit - result.length

    let result2 = await Comment.find(where).select('-__v -parent').lean({ virtuals: true })
      .sort({ createdAt: -1, totalChildren: -1, totalLikes: -1, totalShares: -1 }).limit(limit2)

    result2.forEach(function (cm) {
      result.push(cm);
    })
  }
  // Lấy thêm bài được pin lên top 
  let where2 = { commentType: 'COMMUNITY', status: 'ACTIVE', showHideStatus, parent: { $exists: false }, idCustomer: '10816', isTop: 1 }
  where2.warning = { $lt: 3 } // report 3 tro len an di

  let resultTop = await Comment.find(where2).select('-__v -parent').lean({ virtuals: true })
    .sort({ createdAt: -1 }).limit(1)
  let topId = resultTop[0].id;

  result.forEach(function (cm) {
    if (cm.id != topId) {
      resultTop.push(cm);
    }
  })


  for (let topic of resultTop) {
    let query = { parent: topic._id, status: 'ACTIVE', warning: { $lt: 3 } }
    let children = await Comment.find(query)
      .select('-__v -parent')
      .lean({ virtuals: true })
      .sort({ _id: -1 })
      .limit(1)
    topic.children = children
  }

  if (resultTop && resultTop.length > 0) {
    return res.status(200).send({
      data: resultTop,
      next: '',
      hasNext: false
    })
  }
  return res.status(200).send({
    data: [],
    next: '',
    hasNext: false
  })
})

// API to get a list of topic by catCode or by content message
router.post('/public/find-comments-community', async (req, res) => {

  let { next, limit, catCode, showHideStatus, message } = req.body
  limit = limit ? +limit : 10
  showHideStatus = showHideStatus || 'SHOW'

  let where = { commentType: 'COMMUNITY', status: 'ACTIVE', showHideStatus, parent: { $exists: false } }
  where.warning = { $lt: 3 } // report 3 tro len an di
  if (catCode) {
    where.catCode = catCode
  }

  if (message) {
    where.message = new RegExp(message, 'i')
  }

  let totalSearch = await Comment.countDocuments(where)

  if (next) {
    const [nextUpdatedAt, nextId] = next.split('_')
    where.$or = where.$or || []
    where.$or.push({ updatedAt: { $lt: nextUpdatedAt } })
    where.$or.push({ updatedAt: nextUpdatedAt, _id: { $lt: nextId } })
  }

  let result = await Comment.find(where).select('-__v -parent')
    .lean({ virtuals: true })
    .sort({ updatedAt: -1 })
    .limit(limit)

  for (let topic of result) {
    let query = { parent: topic._id, status: 'ACTIVE', warning: { $lt: 3 } }
    let children = await Comment.find(query)
      .select('-__v -parent')
      .lean({ virtuals: true })
      .sort({ _id: -1 })
      .limit(1)
    topic.children = children
  }

  if (result && result.length > 0) {
    let lastItem = result[result.length - 1]
    const next = `${moment(lastItem.updatedAt).toISOString()}_${lastItem._id}`

    const [nextUpdatedAt, nextId] = next.split('_')
    where.$or = [
      { updatedAt: { $lt: nextUpdatedAt } },
      { updatedAt: nextUpdatedAt, _id: { $lt: nextId } }
    ]
    let totalNextComment = await Comment.countDocuments(where)

    return res.status(200).send({
      data: result,
      next,
      totalSearch: totalSearch || 0,
      hasNext: totalNextComment > 0
    })
  }
  return res.status(200).send({
    data: [],
    next: '',
    totalSearch: totalSearch || 0,
    hasNext: false
  })
})

// API for admin
router.get('/public/find-all-comments', async (req, res) => {

  let { page, pageSize, showHideStatus, commentType, message } = req.query
  page = page ? +page : 1
  pageSize = pageSize ? +pageSize : 10
  let offset = (page - 1) * pageSize

  commentType = commentType || 'COMMUNITY'
  let where = { commentType, status: 'ACTIVE', parent: { $exists: false } }
  if (showHideStatus) {
    where.showHideStatus = showHideStatus
  }
  if (message) {
    where.message = new RegExp(message, 'i')
  }

  var options = {
    sort: { updatedAt: -1 },
    lean: true,
    offset,
    select: '-__v -children',
    limit: pageSize,
  }
  let datas = await Comment.paginate(where, options)

  return res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data: datas
  }))
})

router.post('/public/find-follows-by-comment-id', async (req, res) => {
  if (!req.body.commentId) {
    return res.status(200).send({
      data: []
    })
  }
  let comment = await Comment.findById(req.body.commentId).select('followIds')
  if (comment) {
    return res.status(200).send({
      data: comment.followIds
    })
  }
  return res.status(200).send({
    data: []
  })
})

router.get('/public/find-detail-comments-community', async (req, res) => {
  let { commentId } = req.query
  if (!commentId) {
    return res.status(400).send(cf.buildResponseObject({
      code: ResponseCode.ERROR,
      message: 'CommentId is not empty'
    }))
  }
  let result = {}
  if (mongoose.Types.ObjectId.isValid(commentId)) {
    result = await Comment.findById(commentId).select('-__v -parent').populate({
      path: 'children',
      select: '-__v -parent',
      match: { status: 'ACTIVE', warning: { $lt: 3 } },
      options: { limit: 1, sort: { _id: -1 } }
    })
    let totalChildren = await Comment.countDocuments({ parent: result._id })
    result._doc.totalChildren = totalChildren
  }

  return res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data: result
  }))
})

router.post('/public/find-children-by-comment', async (req, res) => {

  let { next, limit, parentId } = req.body
  limit = limit ? +limit : 10

  let where = { commentType: 'COMMUNITY', status: 'ACTIVE', parent: parentId }
  where.warning = { $lt: 3 } // report 3 tro len an di
  if (next) {
    const [nextCreatedAt, nextId] = next.split('_')
    where.$or = [
      { createdAt: { $lt: nextCreatedAt } },
      { createdAt: nextCreatedAt, _id: { $lt: nextId } }
    ]
  }
  let result = await Comment.find(where)
    .select('-__v -parent')
    .lean({ virtuals: true })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .populate({
      path: 'children',
      select: '-__v -parent',
      match: { status: 'ACTIVE', warning: { $lt: 3 } },
      options: { limit: 1, sort: { createdAt: -1 } }
    })
  if (result && result.length > 0) {
    let lastItem = result[result.length - 1]
    const next = `${moment(lastItem.createdAt).toISOString()}_${lastItem._id}`

    const [nextCreatedAt, nextId] = next.split('_')
    where.$or = [
      { createdAt: { $lt: nextCreatedAt } },
      { createdAt: nextCreatedAt, _id: { $lt: nextId } }
    ]
    let totalNextComment = await Comment.countDocuments(where)

    return res.status(200).send({
      data: result,
      next,
      hasNext: totalNextComment > 0
    })
  }
  return res.status(200).send({
    data: [],
    next: '',
    hasNext: false
  })
})

router.post('/public/find-relate-comments', async (req, res) => {

  let { next, tagNames, catCode, limit, idTopic } = req.body
  limit = limit ? +limit : 10

  if (!tagNames && !catCode) {
    return res.status(200).send({
      data: [],
      next: ''
    })
  }

  let where = {}
  let orCondition = []
  if (tagNames) {
    let hastags = await Hashtag.find({ tagName: { $in: tagNames.split(',') } }).select('comment')
    if (hastags && hastags.length > 0) {
      let commentIds = hastags && hastags.map((item) => item.comment)
      orCondition.push({ _id: { $in: commentIds } })
      if (catCode) {
        orCondition.push({ catCode: catCode })
      }
    } else if (catCode) {
      where.catCode = catCode
    }
  } else if (catCode) {
    where.catCode = catCode
  }

  if (orCondition && orCondition.length > 0) {
    where = { $or: orCondition }
  }
  where = { ...where, commentType: 'COMMUNITY', status: 'ACTIVE', showHideStatus: 'SHOW' }
  where.warning = { $lt: 3 } // report 3 tro len an di
  where.parent = { $exists: false }
  where._id = { $ne: idTopic }

  if (next) {
    const [nextCreatedAt, nextId] = next.split('_')
    where.$or = [
      { createdAt: { $lt: nextCreatedAt } },
      { createdAt: nextCreatedAt, _id: { $lt: nextId } }
    ]
  }
  let result = await Comment.find(where)
    .select('-__v -parent')
    .lean({ virtuals: true })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .populate({
      path: 'children',
      select: '-__v -parent',
      match: { status: 'ACTIVE', warning: { $lt: 3 } },
      options: { limit: 1, sort: { createdAt: -1 } }
    })
  if (result && result.length > 0) {
    let lastItem = result[result.length - 1]
    const next = `${moment(lastItem.createdAt).toISOString()}_${lastItem._id}`

    const [nextCreatedAt, nextId] = next.split('_')
    where.$or = [
      { createdAt: { $lt: nextCreatedAt } },
      { createdAt: nextCreatedAt, _id: { $lt: nextId } }
    ]
    let totalNextComment = await Comment.countDocuments(where)

    return res.status(200).send({
      data: result,
      next,
      hasNext: totalNextComment > 0
    })
  }
  return res.status(200).send({
    data: [],
    next: '',
    hasNext: false
  })
})

router.post('/public/find-tagname', async (req, res) => {

  let { next, tagName, limit } = req.body
  limit = limit ? +limit : 10

  if (!tagName) {
    return res.status(200).send({
      data: [],
      next: ''
    })
  }

  let query = {}
  if (tagName) {
    query.tagName = new RegExp(tagName, 'i')
  }

  if (next) {
    const [nextTagName, nextId] = next.split('_')
    query.$or = [
      { tagName: { $gt: nextTagName } },
      { tagName: nextTagName, _id: { $gt: nextId } }
    ]
  }

  let result = await Hashtag.aggregate(
    [
      { $match: query },
      { $sort: { tagName: 1, _id: 1 } },
      { $group: { _id: '$tagName', code: { $first: '$_id' } } },
      { $limit: limit }
    ]
  ).lean({ virtuals: true })

  if (result && result.length > 0) {
    result = result.map((item) => {
      return { tagName: item._id, _id: item.code }
    })
    let lastItem = result[result.length - 1]
    const next = `${lastItem.tagName}_${lastItem._id}`
    return res.status(200).send({
      data: result,
      next
    })
  }
  return res.status(200).send({
    data: [],
    next: ''
  })
})

router.post('/public/find-comments-stockcode', async (req, res) => {

  let { next, limit, stockCode, showHideStatus } = req.body
  showHideStatus = showHideStatus || 'SHOW'
  if (!stockCode) {
    return res.status(200).send({
      data: [],
      next: ''
    })
  }
  limit = limit ? +limit : 10

  let where = { commentType: 'STOCK_CODE', status: 'ACTIVE', showHideStatus, parent: { $exists: false }, stockCode }
  where.warning = { $lt: 3 } // report 3 tro len an di

  let result = []
  if (next) {
    const [nextCreatedAt, nextId] = next.split('_')
    where.$or = [
      { updatedAt: { $lt: nextCreatedAt } },
      { updatedAt: nextCreatedAt, _id: { $lt: nextId } }
    ]
  }
  result = await Comment.find(where)
    .select('-__v -parent -showHideStatus ')
    .lean({ virtuals: true })
    .sort({ updatedAt: -1, _id: -1 })
    .limit(limit)
    .populate({
      path: 'children',
      select: '-__v -parent',
      match: { status: 'ACTIVE', warning: { $lt: 3 } },
      options: { limit: 1, sort: { updatedAt: -1 } }
    })
  if (result && result.length > 0) {
    let lastItem = result[result.length - 1]
    const next = `${moment(lastItem.updatedAt).toISOString()}_${lastItem._id}`

    const [nextCreatedAt, nextId] = next.split('_')
    where.$or = [
      { updatedAt: { $lt: nextCreatedAt } },
      { updatedAt: nextCreatedAt, _id: { $lt: nextId } }
    ]
    let totalNextComment = await Comment.countDocuments(where)

    return res.status(200).send({
      data: result,
      next,
      hasNext: totalNextComment > 0
    })
  }
  return res.status(200).send({
    data: [],
    next: '',
    hasNext: false
  })
})

router.post('/public/follow-comment', async (req, res) => {
  let { idCustomer, commentId } = req.body
  if (!idCustomer || !commentId) {
    return res.status(400).send({
      message: 'IdCustomer or CommentId is not empty'
    })
  }
  // let test = await Comment.count({ _id: commentId })
  let comment = await Comment.findByIdAndUpdate(commentId, { $push: { followIds: idCustomer } })
  if (!comment) {
    return res.status(400).send({
      message: 'Not found comment'
    })
  }
  return res.status(200).send({
    message: 'Request Success'
  })
})

router.post('/public/un-follow-comment', async (req, res) => {
  let { idCustomer, commentId } = req.body
  if (!idCustomer || !commentId) {
    return res.status(400).send({
      message: 'IdCustomer or CommentId is not empty'
    })
  }
  let comment = await Comment.updateOne({ _id: commentId }, { $pull: { followIds: idCustomer } })
  if (comment && comment.nModified === 0) {
    return res.status(400).send({
      message: 'Not found comment'
    })
  }
  return res.status(200).send({
    message: 'Request Success'
  })
})

router.post('/public/topic/verified', async (req, res) => {
  let { commentId, updateStatus } = req.body
  if (!commentId) {
    return res.status(400).send({
      message: 'CommentId is not empty'
    })
  }
  let comment = await Comment.findByIdAndUpdate(commentId, { status: updateStatus })
  if (!comment) {
    return res.status(400).send({
      message: 'Not found comment'
    })
  }
  return res.status(200).send({
    message: 'Request Success'
  })
})

router.post('/public/topic/show-hide', async (req, res) => {
  let { commentId, updateShowHideStatus } = req.body
  if (!commentId) {
    return res.status(400).send({
      message: 'CommentId is not empty'
    })
  }
  let comment = await Comment.findByIdAndUpdate(commentId, { showHideStatus: updateShowHideStatus })
  if (!comment) {
    return res.status(400).send({
      message: 'Not found comment'
    })
  }
  return res.status(200).send({
    message: 'Request Success'
  })
})

router.get('/private/find-portfolios', AuthMiddleware.authenticateMiddleCustomer, async (req, res) => {
  let idCustomer = req.idCustomer
  if (idCustomer) {
    let sequelize = req.app.locals.sequelize
    let data = await TraddingService.getDataPortfolios(sequelize, idCustomer)
    return res.status(200).send({
      message: 'Request Success',
      data
    })
  }
  return res.status(200).send({
    message: 'Request Success',
    data: {}
  })
})

router.get('/private/find-watchlist', AuthMiddleware.authenticateMiddleCustomer, async (req, res) => {
  let idCustomer = req.idCustomer
  if (idCustomer) {
    let sequelize = req.app.locals.sequelize
    let data = await TraddingService.getDataWatchList(sequelize, idCustomer)
    return res.status(200).send({
      message: 'Request Success',
      data
    })
  }
  return res.status(200).send({
    message: 'Request Success',
    data: []
  })
})

router.post('/public/find-recent-topic', async (req, res) => {

  let { idCustomer, limit, showHideStatus } = req.body
  showHideStatus = showHideStatus || 'SHOW'
  if (!idCustomer) {
    return res.status(200).send({
      data: [],
      next: ''
    })
  }
  limit = limit ? +limit : 5

  let where = { commentType: 'COMMUNITY', status: 'ACTIVE', showHideStatus, parent: { $exists: false } }
  where.warning = { $lt: 3 } // report 3 tro len an di


  where.$or = where.$or || []
  //  Th tac gia
  where.$or.push({ idCustomer: idCustomer })
  // Th like
  where.$or.push({ customerLikes: { $all: [idCustomer] } })
  // TH share
  where.$or.push({ customerShares: { $all: [idCustomer] } })
  // TH follow
  where.$or.push({ followIds: { $all: [idCustomer] } })


  let result1 = await Comment.find(where)
    .select('-__v -children -showHideStatus ')
    .lean({ virtuals: true })
    .sort({ updatedAt: -1, _id: -1 })
    .limit(limit)

  let where2 = { commentType: 'COMMUNITY', status: 'ACTIVE', idCustomer, parent: { $exists: true } }
  where.warning = { $lt: 3 } // report 3 tro len an di

  let result2 = await Comment.find(where2)
    .select('-__v -showHideStatus ')
    .lean({ virtuals: true })
    .sort({ updatedAt: -1, _id: -1 })
    .limit(limit)
    .populate({
      path: 'parent',
      select: '-__v -children',
      match: { status: 'ACTIVE', warning: { $lt: 3 } },
      options: { limit: 1 }
    })
  let ids1 = result1.map(item => item._id.toString())
  result2.forEach((item) => {
    if (item.parent && !ids1.includes(item.parent._id.toString())) {
      result1.push(item.parent);
    }
  })
  result1.sort(function (item1, item2) {
    return new Date(item2.requestTime) - new Date(item1.requestTime);
  })
  if (result1 && result1.length > 0) {
    return res.status(200).send({
      data: result1.slice(0, 5)
    })
  }
  return res.status(200).send({
    data: []
  })
})

router.post('/public/topic/change-category', async (req, res) => {
  let { commentId, catCode } = req.body
  if (!commentId) {
    return res.status(400).send({
      message: 'CommentId is not empty'
    })
  }
  let comment = await Comment.findByIdAndUpdate(commentId, { catCode: catCode })
  if (!comment) {
    return res.status(400).send({
      message: 'Not found comment'
    })
  }
  return res.status(200).send({
    message: 'Request Success'
  })
})

router.get('/public/comment/statistics', async (req, res) => {

  let where = { commentType: 'COMMUNITY', status: 'ACTIVE', parent: { $exists: false }, warning: { $lt: 3 } }

  let result = await Comment.aggregate(
    [
      { $match: { parent: { $exists: false }, commentType: 'COMMUNITY', status: 'ACTIVE', warning: { $lt: 3 } } },
      {
        $group: {
          _id: "$catCode",
          totalLikes: { $sum: "$totalLikes" },
          totalShares: { $sum: "$totalShares" },
          totalChildren: { $sum: "$totalChildren" },
          totalTopic: { $sum: 1 }
        }
      }
    ]
  )

  for (let category of result) {
    let query = { commentType: 'COMMUNITY', catCode: category._id }
    let listTopicIds = await Comment.find(query).select('_id')

    let totalClick = 0
    if (listTopicIds && listTopicIds.length > 0) {
      listTopicIds = listTopicIds.map(item => item._id)
      let where = { actionCode: 'CLICK_TOPIC', actionType: 'COMMUNITY', targetId: { $in: listTopicIds } }
      totalClick = await ActionLog.countDocuments(where)
    }
    category.totalClick = totalClick
  }

  return res.status(200).send({
    data: result
  })
})

router.get('/public/comment/report-comment', async (req, res) => {

  let { fromDate, toDate, commentType, catCode } = req.query // fromDate toDate >> YYYY-MM-DD

  if (!fromDate || !toDate) {
    fromDate = toDate = moment().format('YYYY-MM-DD')
  }

  fromDate = new Date(fromDate)
  toDate = new Date(toDate)

  let query = {
    status: 'ACTIVE',
    parent: { $exists: false },
    createdAt: {
      $gte: fromDate,
      $lt: toDate
    }
  }

  if (commentType) {
    query.commentType = commentType
  }
  if (catCode) {
    query.catCode = catCode
  }

  let dataCreated = await Comment.aggregate(
    [
      {
        $match: query
      },
      {
        $group: {
          _id: "$idCustomer",
          total: { $sum: 1 }
        }
      }
    ]
  )

  query.parent = { $exists: true }

  let dataReply = await Comment.aggregate(
    [
      {
        $match: query
      },
      {
        $group: {
          _id: "$idCustomer",
          total: { $sum: 1 }
        }
      }
    ]
  )
  
  let query2 = {
    actionType: 'COMMUNITY',
    createdAt: {
      $gte: moment(fromDate).format('YYYY-MM-DD hh:mm:ss'),
      $lt: moment(toDate).format('YYYY-MM-DD hh:mm:ss')
    }
  }
  query2.$or = [
    { actionCode: 'FOLLOW_TOPIC'},
    { actionCode: 'UN_FOLLOW_TOPIC'},
    { actionCode: 'LIKE_TOPIC'},
    { actionCode: 'UNLIKE_TOPIC'},
    { actionCode: 'REPORT_TOPIC'},
    { actionCode: 'SHARE_TOPIC'},
    { actionCode: 'COMMENT_TOPIC'},
  ]
  let dataInteract = await ActionLog.aggregate(
    [
      {
        $match: query2
      },
      {
        $group: {
          _id: "$idCustomer",
          total: { $sum: 1 }
        }
      }
    ]
  )

  let result = {
    totalCreateComment: dataCreated.length,
    totalReplyComment: dataReply.length,
    totalInteract: dataInteract.length,
  }

  return res.status(200).send(cf.buildResponseObject({
    code: ResponseCode.SUCCESS,
    message: 'Request Success',
    data: result
  }))
})

module.exports = router
