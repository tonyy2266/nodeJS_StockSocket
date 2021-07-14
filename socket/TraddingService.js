
var request = require('request-promise');
const mongoose = require('mongoose')
const moment = require('moment');
const config = require('../config');
const _ = require('lodash');
const Sequelize = require('sequelize')
const Op = Sequelize.Op
const cf = require('../helpers/CF')
var SolrNode = require('solr-node')
const NodeCache = require('node-cache')
const myCache = new NodeCache()
const StockInfoMongo = require('../modelsMongo/StoctInfo')
const StockReportMongo = require('../modelsMongo/StockReport')
const MarketStatus = require('../modelsMongo/MarketStatus')


var client_stock_trading_info = new SolrNode(config.client_stock_trading_info)
var client_maket_index = new SolrNode(config.client_maket_index)
var client_maket_index_goline = new SolrNode(config.client_maket_index_goline)
var client_stock_trading_report_watchlist = new SolrNode(config.client_stock_trading_report_watchlist)
var client_stock_info_line = new SolrNode(config.client_stock_info_line)
var client_stock_exchange_status = new SolrNode(config.stock_exchange_status)
var client_search_all = new SolrNode(config.client_search_all)

const defaultMarketStatus = [
  {
    "market_status": "O",
    "stock_exchange": "HOSE"
  },
  {
    "market_status": "O",
    "stock_exchange": "HNX"
  },
  {
    "market_status": "O",
    "stock_exchange": "UPCOM"
  }
]

const importDefaultMarketStatus = async () => {
  for (let i = 0; i < defaultMarketStatus.length; i++) {
    const element = defaultMarketStatus[i];
    try {
      await client_stock_exchange_status.update(element, { commit: true })
    } catch (error) {
      console.log('error:', error)
    }
  }
}

const getDataDealVietStock = async () => {
  request('https://api.vietstock.vn/ctd/deal', function (error, response, body) {
    console.log('test:' + body);
    return JSON.parse(body)
  })
}

const getOrderListByStockCode = async (sequelize, stockExchange, isVirtualTrading = true, isTradingDay = false) => {
  let result = []
  let currentTime = moment().format('HH:mm:ss')
  let sql = `select o.name order_name, o.description
                    from
                      trading_db.order_type_configuration o
                    where
                      o.stock_exchange = :stockExchange `
  if (isTradingDay) {
    sql += ` and (time(o.end_time) - time(:currentTime) > 0) and (time(o.start_time) - time(:currentTime) < 0) `
  } else {
    sql = ` select DISTINCT(name) order_name, description from
            trading_db.order_type_configuration o
          where
            o.stock_exchange = :stockExchange  `
    sql += stockExchange === 'HOSE' ? ` and o.name in ('LO', 'ATO') ` : ` and o.name = 'LO' `
  }                    
  let orderTypes = await sequelize.query(sql,
    {
      replacements: {
        stockExchange,
        currentTime
      }, type: sequelize.QueryTypes.SELECT
    }
  )

  // console.log('==================== orderTypes:', orderTypes);
  // console.log('==================== orderTypes:', orderTypes.length);

  if (!orderTypes || orderTypes.length === 0) {
    let sql = isVirtualTrading ? ` select DISTINCT(name) order_name, description from order_type_configuration where stock_exchange = :stockExchange `
      : ` select name order_name, description from order_type_configuration where name='LO' LIMIT 1 `

    orderTypes = await sequelize.query(sql, { replacements: { stockExchange }, type: sequelize.QueryTypes.SELECT })
  }


  return orderTypes && orderTypes.length > 0 ? result.concat(orderTypes) : result
}

const toObjectOrderTemplate = async (arr) => {
  if (arr && arr.length === 0) {
    return null
  }
  var rv = {}
  arr.forEach(item => {
    rv[item.code] = item.description
  })
  return rv
}

const toObjectOrderConfig = async (arr) => {
  if (arr && arr.length === 0) {
    return null
  }
  var rv = {}
  arr.forEach(item => {
    rv[item.orderConfigKey] = item.orderConfig
  })
  return rv
}

const findOrderTypesTemplates = async () => {

  let orderTemplates = myCache.get('orderTemplates')
  if (!orderTemplates || orderTemplates === undefined) {
    let listOrderTemplate = await request(config.urlOrderTemplate)
    listOrderTemplate = listOrderTemplate ? JSON.parse(listOrderTemplate) : {}
    listOrderTemplate = listOrderTemplate.data || []

    if (listOrderTemplate && listOrderTemplate.length > 0) {
      let orderTemplates = await toObjectOrderTemplate(listOrderTemplate)

      for (let i = 0; i < listOrderTemplate.length; i++) {
        const element = listOrderTemplate[i]
        try {
          orderTemplates[element.code] = element.description ? JSON.parse(element.description.replace(/(\r\n|\n|\r)/gm, '')) : {}
        } catch (error) {
          console.log(error)
        }
      }
      myCache.set('orderTemplates', orderTemplates, 10000)
      return orderTemplates
    }
  }
  return orderTemplates || {}
}

const findOrderTypesConfig = async () => {

  let orderTypesConfig = myCache.get('orderTypesConfig')
  if (!orderTypesConfig || orderTypesConfig === undefined) {
    let listOrderConfig = await request(config.urlOrderTypesConfig)
    listOrderConfig = listOrderConfig ? JSON.parse(listOrderConfig) : []

    if (listOrderConfig && listOrderConfig.data.length > 0) {
      let orderConfig = await toObjectOrderConfig(listOrderConfig.data)
      myCache.set('orderTypesConfig', orderConfig, 10000)
      return orderConfig
    }
  }
  return orderTypesConfig || {}
}

const getStockExchangeKeyStatus = async (stockExchange) => {
  const result = await MarketStatus.findOne({ stock_exchange: stockExchange })
  return result && result._doc ? `${result._doc.stock_exchange}${result._doc.market_status}` : ''
}

const checkIsTradingDay = async () => {
  const options = {
    url: `${config.urlOptionCheckTradingDay}${moment().format('YYYY-MM-DD')}`,
    headers: { Authorization: config.tokenSystemAuth }
  }
  let dataTradingDay = await request.get(options)
  return dataTradingDay && JSON.parse(dataTradingDay) != null && JSON.parse(dataTradingDay).data
}

const getDataByDateAndStockCodes = async (sequelize, stockCode, idCustomer) => {

  const isTradingDay = await checkIsTradingDay()

  let data = await sequelize.query(`select
                                        c.name,
                                        c.code,
                                        c.stock_exchange,
                                        c.introduction,
                                        (select id idWatchList from watch_list where stock_code=:stockCode and id_customer=:idCustomer and deleted_at is null LIMIT 1) idWatchList,
                                        (select COALESCE(vp.total_volumn, 0) from virtual_portfolio vp where vp.id_customer=:idCustomer and vp.deleted_at is null and vp.stock_code = :stockCode and vp.total_volumn  > 0 limit 1) total_volumn,
                                        COALESCE(c.margin,0) margin,
                                        (c.has_news = true) has_news
                                    from
                                        company c
                                    where    c.code = :stockCode `,
    {
      replacements: {
        idCustomer: idCustomer,
        stockCode: stockCode
      }, type: sequelize.QueryTypes.SELECT
    }
  )
  if (data && data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      let element = data[i];
      let orderTypes = await getOrderListByStockCode(sequelize, element.stock_exchange || 'HOSE', true, isTradingDay)
      if (orderTypes && orderTypes.length > 0) {
        element.order_type = orderTypes
      }
      let stockInfo = await findDetailInforByStockCode(element.code, 'PINE_SOCKET')
      if (stockInfo) {
        data[i] = { ...element, ...stockInfo }
      }
    }
  }
  return { ...data }
}

const findOrderTypeByStockExchange = async (stockExchange) => {
  const key = await getStockExchangeKeyStatus(stockExchange)
  const orderTypeConfig = await findOrderTypesConfig()
  const templates = await findOrderTypesTemplates()
  const strArrayOrder = await orderTypeConfig[key]
  let result = []
  if (strArrayOrder) {
    let array = strArrayOrder.split(';')
    if (array && array.length > 0) {
      array.forEach(x => {
        result.push({ order_name: x, description: templates[x] })
      })
    }
  }
  return result
}

const getDataByDateAndStockCodesPine = async (sequelize, stockCode) => {
  let data = await sequelize.query(`select
                                        c.name,
                                        c.code,
                                        c.stock_exchange,
                                        c.introduction,
                                        COALESCE(c.margin,0) margin,
                                        (c.has_news = true) has_news
                                    from
                                        company c
                                    where    c.code = :stockCode `,
    {
      replacements: {
        stockCode: stockCode
      }, type: sequelize.QueryTypes.SELECT
    }
  )
  if (data && data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      let element = data[i];
      let orderTypes = await findOrderTypeByStockExchange(element.stock_exchange)
      if (orderTypes && orderTypes.length > 0) {
        element.order_type = orderTypes
      }
      let stockInfo = await findDetailInforByStockCode(element.code, 'PINE_SOCKET')
      if (stockInfo) {
        data[i] = { ...element, ...stockInfo }
      }
    }
  }
  return { ...data }
}

const getDataPortfolios = async (sequelize, idCustomer) => {
  let data = await sequelize.query(`
                                      select
                                        v.id id_virtual_portfolio,
                                        COALESCE(v.total_earning) total_earning,
                                        COALESCE(v.total_volumn, 0) total_volumn,
                                        v.stock_code,
                                        (select c.image from company c where c.code=v.stock_code limit 1) url_image_company,
                                        COALESCE(v.average_price, 0) total_match_price
                                      from
                                        virtual_portfolio v
                                      where 1 = 1
                                        and v.deleted_at is null
                                        and v.id_customer = :idCustomer
                                        and v.total_volumn > 0
                                      order by
                                        v.updated_at desc`,
    {
      replacements: {
        idCustomer: idCustomer
      }, type: sequelize.QueryTypes.SELECT
    }
  )
  let total_gain_loss = 0
  let total_gain_loss_percent = 0

  if (data && data.length > 0) {
    let total_buy_match = 0  // tong gia tri mua
    let total_buy_current = 0 // tong gia tri hien tai
    for (let i = 0; i < data.length; i++) {
      let element = data[i]
      let stockInfo = await findDetailInforByStockCode(element.stock_code)
      if (stockInfo) {
        delete stockInfo.id
        let current_match_price = (!stockInfo.current_match_price || !stockInfo.current_match_price === 0)
          ? stockInfo.ref_price : stockInfo.current_match_price

        element.gain_loss = (current_match_price - element.total_match_price) * element.total_volumn
        element.gain_loss_percent = (element.total_volumn * element.total_match_price) > 0
          ? (element.gain_loss / (element.total_volumn * element.total_match_price)) * 100 : 0
        element = { ...element, ...stockInfo, url_image_company: `${config.urlImageCompany}${element.url_image_company}` }
        total_buy_match += element.total_volumn * element.total_match_price
        total_buy_current += element.total_volumn * current_match_price
        total_gain_loss += element.gain_loss
        data[i] = element
      }
    }
    total_gain_loss_percent = total_buy_match > 0 ? (total_buy_current - total_buy_match) * 100 / total_buy_match : 0
  }

  console.log('run getDataPortfolios with idCustomer:' + idCustomer);
  // console.log(data)
  // let total_gain_loss = data ? data.reduce((total, x) => x.gain_loss + total, 0) : 0
  // let total_gain_loss_percent = data ? data.reduce((total, x) => x.gain_loss_percent + total, 0) : 0

  return { total_gain_loss, total_gain_loss_percent, total_stock: data.length, portfolios: data }
}

const getRandomArbitrary = async (min, max) => {
  return Math.random() * (max - min) + min;
}

const getRandomListFromRange = async (min, max, refPrice) => {
  let result = []
  let numberRandom = min
  for (let i = 0; i < 20; i++) {
    numberRandom = await getRandomArbitrary(min, max)
    result.push(numberRandom)
  }
  result.push(refPrice)
  return result
}

const getDataWatchList = async (sequelize, idCustomer) => {
  let watchLists = await sequelize.query(`
                                          select
                                            w.id idWatchList,
                                            w.stock_code,
                                            (select c.name from company c where c.code = w.stock_code limit 1) stock_name
                                          from
                                            watch_list w
                                          where 1=1
                                            and w.id_customer = :idCustomer
                                            and w.deleted_at is null
                                          order by w.stock_code asc
                                          `,
    {
      replacements: {
        idCustomer: idCustomer
      }, type: sequelize.QueryTypes.SELECT
    }
  )
  if (watchLists && watchLists.length > 0) {
    for (let i = 0; i < watchLists.length; i++) {
      let element = watchLists[i]
      let stockInfo = await findDetailInforByStockCode(element.stock_code)
      if (stockInfo) {
        watchLists[i] = { ...element, ...stockInfo }
      }
    }
  }
  return watchLists
}

const deleteStockTradingInfoOverMinutes = async () => {
  // get max log_date
  let max_log_date = await getMaxLogDate()
  const { host, port, core } = config.client_stock_trading_info
  max_log_date = max_log_date - config.limitMinutes_Keeping_10_minutes

  // delete data solr
  await request(`http://${host}:${port}/solr/${core}/update?stream.body=%3Cdelete%3E%3Cquery%3Elog_date:[*%20TO%20${max_log_date}]%3C/query%3E%3C/delete%3E&commit=true`)
  // const test = await request(`http://${host}:${port}/solr/admin/cores?action=RELOAD&core=${core}`)
}

// const deleteStockReportTradingInfoOverMinutes = async () => {
//   let sysdate = moment().format('YYYY-MM-DD')
//   console.log(sysdate)
//   StockReportMongo.deleteMany({ trading_date: { $ne: sysdate } }, (err) => {
//     if (err) console.log(err)
//   })
// }

// const deleteStockTradingMarketIndex = async () => {
//   // get max log_date
//   let max_log_date = await getMaxLogDateMarketIndex()
//   const { host, port, core } = config.client_maket_index
//   max_log_date = max_log_date - config.limitMinutes_Keeping_10_minutes

//   // delete data solr
//   await request(`http://${host}:${port}/solr/${core}/update?stream.body=%3Cdelete%3E%3Cquery%3Elog_date:[*%20TO%20${max_log_date}]%3C/query%3E%3C/delete%3E&commit=true`)
//   // const test = await request(`http://${host}:${port}/solr/admin/cores?action=RELOAD&core=${core}`)
// }


const importAllMarketIndex = async (isImportGoline = false) => {
  console.log('import socket importAllMarketIndex ');
  let log_date = moment().valueOf()
  let lsMaketIndex = await getListMarketIndex(log_date, isImportGoline)
  if (lsMaketIndex) {
    for (let i = 0; i < lsMaketIndex.length; i++) {
      const element = lsMaketIndex[i];
      if (!element.market_code) {
        continue
      }
      let market = await findMarketByMarketCode(element.market_code, isImportGoline)
      market = market ? { ...market, ...element } : { ...element }
      // remove version if existed
      delete market._version_

      try {
        // console.log(element);
        const update_index = isImportGoline ? client_maket_index_goline.update(market, { commit: true }) : await client_maket_index.update(market, { commit: true })
      } catch (e) {
        console.log(e)
        console.error(e)
        console.error(market.market_code)
      }
    }
  }
}

const updateStockInfoByCode = async (stock_code, inputData, importPine) => {
  if (!stock_code || !inputData) {
    return
  }
  StockInfoMongo.updateOne({ stock_code }, inputData, (err) => {
    if (err) console.log(err)
  })
}

const importToSolrAllStockInfor = async (importPine = false) => {
  let stockExchangeList = config.stockExchangeList.split(',')
  let log_date = moment().valueOf()
  for (let i = 0; i < stockExchangeList.length; i++) {
    const stockExchange = stockExchangeList[i];
    // get data vietstock by exchange
    let lsStockData = await getListInfoReportStockByStockExchange(stockExchange)

    // import data to solr by exchange
    if (lsStockData) {
      let index = Math.floor(lsStockData.length / 2)
      // console.log(index);
      // let arr1 = lsStockData.splice(0, index)
      for (let i = 0; i < index; i++) {
        const element = lsStockData[i]
        console.log(`----------------${element.stock_exchange}------------`, element.stock_code, '------', i)
        updateStockInfoByCode(element.stock_code, element, importPine)
      }

      for (let i = index; i < lsStockData.length; i++) {
        const element = lsStockData[i]
        console.log(`----------------${element.stock_exchange}------------`, element.stock_code, '------', i)
        updateStockInfoByCode(element.stock_code, element, importPine)
      }
    }
  }
}

const importToSolrAllStockInforGoline = async () => {
  let log_date = moment().valueOf()
  // get data vietstock by exchange
  let result = []
  for (const key in objMapperBoard) {
    const element = objMapperBoard[key]

    let lsStockData = await getListInfoStockGoline(log_date, key)

    // import data to solr by exchange
    if (lsStockData && lsStockData.length > 0) {
      let index = Math.floor(lsStockData.length / 2)
      // console.log(index);
      // let arr1 = lsStockData.splice(0, index)
      for (let i = 0; i < index; i++) {
        const element = lsStockData[i]
        console.log(`----------------${element.stock_exchange}------------`, element.stock_code, '------', i)
        updateStockInfoByCode(element.stock_code, element, true)
      }

      for (let i = index; i < lsStockData.length; i++) {
        const element = lsStockData[i]
        console.log(`----------------${element.stock_exchange}------------`, element.stock_code, '------', i)
        updateStockInfoByCode(element.stock_code, element, true)
      }
    }
  }
  return result
}

// const importToSolrReportStock = async () => {
//   let stockExchangeList = config.stockExchangeList.split(',')
//   for (let i = 0; i < stockExchangeList.length; i++) {
//     const stockExchange = stockExchangeList[i];
//     let lsStockData = await getListInfoReportStockByStockExchange(stockExchange)
//     if (lsStockData && lsStockData.length > 0) {
//       for (let i = 0; i < lsStockData.length; i++) {
//         const element = lsStockData[i]
//         console.log('import report Mongo:', element.stock_code);
//         StockReportMongo.findOne({ stock_code: element.stock_code, trading_date: element.trading_date }).exec((err, doc) => {
//           if (err) {
//             console.log(err) 
//             return
//           }
//           if (doc) {
//             StockReportMongo.updateOne({_id: doc.id}, { $push: { last_prices: element.last_price }, updated_at: element.updated_at }, (err2) => {
//               if (err2) {
//                 console.log(err2) 
//                 return
//               }
//             })
//           } else {
//             doc = { ...element }
//             doc.last_prices = [element.last_price]
//             delete doc.last_price
//             let report = new StockReportMongo({ _id: new mongoose.Types.ObjectId(), ...doc })
//             report.save(function (err2) {
//               if (err2) {
//                 console.log(err2) 
//                 return
//               }
//             })
//           }
//         })
//       }
//     }
//   }
// }

const stock_exchange_map = {
  'HOSE': 1, 'HNX': 2, 'UPCOM': 3, 'VN30': 4, 'HNX30': 5, 'ALL': 0
}

const getListInfoReportStockByStockExchange = async (stock_exchange) => {
  let catId = stock_exchange_map[stock_exchange] ? stock_exchange_map[stock_exchange] : 0
  let lsStockData = []
  let tempData = await request(`https://api.vietstock.vn/data/liststockprice?languageid=1&catid=${catId}`)
  if (tempData) {
    tempData = JSON.parse(tempData)
    let m = moment()
    if (tempData && tempData.length > 0) {
      for (let i = 0; i < tempData.length; i++) {
        let stockData = {}
        stockData.stock_exchange = tempData[i].Exchange
        stockData.stock_code = tempData[i].StockCode
        stockData.last_price = tempData[i].LastPrice / config.devideConfig
        stockData.updated_at = m.format()
        stockData.trading_date = m.format('YYYY-MM-DD')
        lsStockData.push(stockData)
      }
    }
  }
  return lsStockData;
}

const getListInfoStockGoline = async (log_date, key) => {
  let lsStockData = []
  let tempData = await request.post({ url: config.urlStockBoardGoline, form: { Board: key } })
  if (tempData) {
    tempData = JSON.parse(tempData)
    tempData = tempData.Data
    if (tempData && tempData.length > 0) {
      for (let i = 0; i < tempData.length; i++) {
        let element = await mapperStockDataLine(tempData[i])
        // console.log(element);
        lsStockData.push({ ...element, log_date })
      }
    }
  }
  return lsStockData;
}

const getListMarketIndex = async (log_date, isImportGoline) => {
  let tempData = isImportGoline ? await request.post(config.urlMaketIndexGoline) : await request.get(config.urlMaketIndexVietStock)
  if (!tempData) {
    return []
  }
  tempData = JSON.parse(tempData)
  tempData = isImportGoline ? tempData.Data : tempData
  if (!tempData || tempData.length === 0) {
    return []
  }

  if (isImportGoline) {
    return await mapperMarketDataGoline(tempData, log_date)
  }
  return await mapperMarketDataVietStock(tempData, log_date)
}

const genInnerQuery = async (stockCodes) => {
  if (!stockCodes) {
    return ""
  }
  let array = stockCodes.split(',')
  let query = '('
  for (let i = 0; i < array.length; i++) {
    if (i !== 0) {
      query += ' OR '
    }
    query += `stock_code%3A${array[i]}`
  }
  query += ')'
  return query
}

const findDetailInforByStockCode = async (stockCodes, socket_type) => {

  let stockInfo = await StockInfoMongo.findOne({ stock_code: stockCodes })
  return stockInfo ? stockInfo._doc : {}
}

const findSimpleDetailInforByStockCode = async (stockCodes) => {

  let stockInfo = await StockInfoMongo.findOne({ stock_code: stockCodes }).select('-list_customer_alert -__v -_id')
  return stockInfo ? stockInfo._doc : {}
}

const findSimpleListDetailInforByListStockCode = async (stockCodes, socket_type) => {

  let lsData = await StockInfoMongo.find({ stock_code: stockCodes }).select('-list_customer_alert -__v -_id')
  return lsData && lsData.length > 0 ? lsData : []
}

const mongoFindStockCodes = async (stockCodes) => {
  if (!stockCodes) {
    return []
  }
  let arrStockCodes = stockCodes.split(',')
  let lsData = await StockInfoMongo.find({ stock_code: { $in: arrStockCodes } }).select('last_price stock_code')
  return lsData && lsData.length > 0 ? lsData : []
}

// const findReportByStockCode = async (stockCodes) => {
//   let lsData = await StockReportMongo.findOne({ stock_code: stockCodes })
//     .select(' last_prices ')
//     .sort({
//       trading_date: 'desc'
//     })
//   // if (lsData && lsData.length > 0) {
//   //   lsData = lsData.map(x => x.last_price)
//   // }
//   return lsData ? lsData.last_prices : []
// }

const findMarketByMarketCode = async (marketCode, isImportGoline = false) => {
  let query = `q=market_code%3A${marketCode}&rows=1&sort=log_date%20desc&start=0&wt=json`

  try {
    const data = isImportGoline ? await client_maket_index_goline.search(query) : await client_maket_index.search(query);
    // console.log('Response:', data.response.docs);
    if (data.response.docs && data.response.docs.length > 0) {
      return data.response.docs[0]
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}


const getMaxLogDate = async () => {
  let query = `q=*%3A*&rows=1&sort=log_date%20desc&start=0&fl=log_date&wt=json`
  try {
    const data = await client_stock_trading_info.search(query);
    if (data.response.docs && data.response.docs.length > 0) {
      return data.response.docs[0].log_date
    }
  } catch (e) {
    console.error(e);
  }
  return 0
}

const getMaxLogDateMarketIndex = async () => {
  let query = `q=*%3A*&rows=1&sort=log_date%20desc&start=0&fl=log_date&wt=json`
  try {
    const data = await client_maket_index.search(query);
    if (data.response.docs && data.response.docs.length > 0) {
      return data.response.docs[0].log_date
    }
  } catch (e) {
    console.error(e);
  }
  return 0
}

const map_cat_market = {
  1: "VN-Index", 2: "HNX-Index", 3: "UPCOM-Index", 4: "VN30-Index"
}

const map_cat_market_revert = {
  "VN-Index": 1, "HNX-Index": 2, "UPCOM-Index": 3, "VN30-Index": 4
}

const getDataMarketIndex = async (isLimit = true) => {

  let query = `q=*%3A*&sort=market_code%20desc&start=0&wt=json`

  let result = []
  try {
    const data = await client_maket_index.search(query);
    // console.log('Response:', data.response.docs);
    if (data.response.docs && data.response.docs.length > 0) {
      for (let i = 0; i < data.response.docs.length; i++) {
        const element = data.response.docs[i]

        element.market_code_name = element.market_code.replace('-', '').toUpperCase()

        let catId = map_cat_market_revert[element.market_code]
        let chartmarket = await request(`https://api.vietstock.vn/data/chartmarket?catID=${catId}`)
        chartmarket = JSON.parse(chartmarket)
        if (isLimit && chartmarket && chartmarket.length > 60) {
          chartmarket = chartmarket.slice(chartmarket.length - 60, chartmarket.length)
        }
        element.chartmarkets = chartmarket && chartmarket.length > 0 ? chartmarket.map((x) => { return x.Price }) : []

        for (const key in element) {
          if (element.hasOwnProperty(key) && key === 'market_code') {
            const data = element[key]
            if (data === ('VN-Index' || 'VN-INDEX')) {
              element[key] = data.replace("-", "")
            } else {
              element[key] = data.split('-')[0]
            }
          } else if (element.hasOwnProperty(key) && key === 'market_code_name') {
            const data = element[key]
            if (data === 'VN30INDEX') {
              element[key] = 'VN30'
            }
          }
        }

        result.push(element)
      }
    }
  } catch (e) {
    console.error(e);
  }
  if (result && result.length > 3) {
    result = await cf.array_move(result, 2, 3)
  }
  return result
}

const mapperStockData = async (inputData) => {

  // if (inputData.StockCode === 'FPT') {
  //   console.log('test ');
  // }
  const stockData = {}
  stockData.stock_exchange = inputData.Exchange
  stockData.stock_code = inputData.StockCode
  // stockData.trading_date = inputData.TradingDate
  stockData.ref_price = inputData.PriorClosePrice / config.devideConfig
  stockData.ceil_price = inputData.CeilingPrice / config.devideConfig
  stockData.floor_price = inputData.FloorPrice / config.devideConfig
  stockData.total_volumn_market = inputData.TotalVol
  stockData.total_val = inputData.TotalVal / config.devideConfig
  stockData.highest_price = inputData.HighestPrice / config.devideConfig
  stockData.lowest_price = inputData.LowestPrice / config.devideConfig
  stockData.current_match_price = inputData.LastPrice / config.devideConfig
  stockData.last_price = inputData.LastPrice / config.devideConfig
  stockData.open_price = inputData.OpenPrice / config.devideConfig
  stockData.avr_price = inputData.AvrPrice / config.devideConfig
  stockData.change_price = inputData.Change / config.devideConfig
  stockData.change_price_percent = inputData.PerChange
  stockData.floor_price_52_week = inputData.Min52W / config.devideConfig
  stockData.ceil_price_52_week = inputData.Max52W / config.devideConfig
  stockData.volumn_52_week = inputData.Vol52W
  stockData.outstanding_buy = inputData.OutstandingBuy / config.devideConfig
  stockData.outstanding_sell = inputData.OutstandingSell / config.devideConfig

  stockData.total_put_val = inputData.TotalPutVal
  stockData.total_put_vol = inputData.TotalPutVol

  stockData.last_vol = inputData.LastVol

  stockData.buy_price_1 = inputData.Best1Bid / config.devideConfig
  stockData.buy_volumn_1 = inputData.Best1BidVol

  stockData.buy_price_2 = inputData.Best2Bid / config.devideConfig
  stockData.buy_volumn_2 = inputData.Best2BidVol

  stockData.buy_price_3 = inputData.Best3Bid / config.devideConfig
  stockData.buy_volumn_3 = inputData.Best3BidVol

  stockData.sell_price_1 = inputData.Best1Offer / config.devideConfig
  stockData.sell_volumn_1 = inputData.Best1OfferVol

  stockData.sell_price_2 = inputData.Best2Offer / config.devideConfig
  stockData.sell_volumn_2 = inputData.Best2OfferVol

  stockData.sell_price_3 = inputData.Best3Offer / config.devideConfig
  stockData.sell_volumn_3 = inputData.Best3OfferVol

  stockData.total_room = inputData.TotalRoom
  stockData.current_room = inputData.CurrRoom

  stockData.total_room = inputData.TotalRoom
  stockData.current_room = inputData.CurrRoom

  stockData.foreign_buy_vol = inputData.F_BuyVol
  stockData.foreign_buy_val = inputData.F_BuyVal

  stockData.foreign_sell_vol = inputData.F_SellVol
  stockData.foreign_sell_val = inputData.F_SellVal
  return stockData
}

const mapperMarketDataVietStock = async (lsData, sysdate) => {
  if (lsData) {
    return lsData.map((inputData) => {
      const market = {}
      market.market_code = inputData.Code
      market.market_cap = `${inputData.MarketCap}`
      market.market_name = inputData.Name
      market.change_index_price = inputData.Change
      market.change_index_percent_price = inputData.PerChange
      market.stock_exchange = inputData.Exchange ? inputData.Exchange.toUpperCase() : ''
      market.current_index_price = inputData.Price
      market.total_val = inputData.TotalVal
      market.total_vol = inputData.TotalVol
      market.no_change = inputData.NoChange
      market.advances = inputData.Advances
      market.advances_ceiling = inputData.AdvancesCeiling
      market.declines = inputData.Declines
      market.declines_floor = inputData.DeclinesFloor
      market.total_buy_vol = inputData.TotalBuyVol
      market.total_sell_vol = inputData.TotalSellVol
      market.total_put_val = inputData.TotalPutVal
      market.total_put_vol = inputData.TotalPutVol
      market.log_date = sysdate
      return market
    })
  }
  return []
}

const obj_stock_exchange_mapper = {
  '100': 'HOSE',
  '200': 'HNX',
  '300': 'UPCOM'
}

const obj_market_mapper_name = {
  '100': 'VN-Index',
  '101': 'VN30-Index',
  '200': 'HNX-Index',
  '300': 'UPCOM-Index',

}

// const market_status_mapper = {
//   'P':1,
//   'O':2,
//   'A':3,
//   'C':4,
//   'K':5,
//   'H':10,
//   'S':0,
// }

// const market_status_mapper_revert = {
//   1:'P',
//   2:'O',
//   3:'A',
//   4:'C',
//   5:'K',
//   10:'H',
//   0:'S',
// }

const mapperMarketDataGoline = async (lsData, sysdate) => {
  if (lsData) {
    return lsData.map((inputData) => {
      const market = {}
      market.market_code = obj_market_mapper_name[`${inputData.IndexCd}`]
      market.change_index_price = inputData.ChangeIndex
      market.open_index = inputData.OpenIndex
      market.change_index_percent_price = inputData.ChangePercent
      market.stock_exchange = objMapperBoard[inputData.Board]
      market.current_index_price = inputData.Index
      market.total_val = inputData.Value
      market.total_vol = inputData.Volume
      market.no_change = inputData.NoChange
      market.advances = inputData.Up
      market.declines = inputData.Down
      market.session_name = inputData.SessionName
      market.log_date = sysdate
      return market
    })
  }

  return []
}

const objMapperBoard = {
  'M': 'HOSE',
  'S': 'HNX',
  'O': 'OTC',
  'U': 'UPCOM'
}

const mapperStockDataLine = async (inputData) => {

  const stockData = {}
  stockData.stock_exchange = objMapperBoard[inputData.Board]
  stockData.stock_code = inputData.Symbol
  stockData.ref_price = inputData.Basic
  stockData.ceil_price = inputData.Ceil
  stockData.floor_price = inputData.Floor
  stockData.total_volumn_market = inputData.TotalVolume
  stockData.total_val = inputData.TotalValue
  stockData.highest_price = inputData.High
  stockData.lowest_price = inputData.Low
  stockData.current_match_price = inputData.Last
  stockData.last_vol = inputData.LastVolume
  stockData.last_price = inputData.Last
  stockData.open_price = inputData.Open
  stockData.close_price = inputData.Close
  stockData.avr_price = inputData.AvgPrirce
  stockData.change_price = inputData.Change
  stockData.change_price_percent = inputData.PerChange

  // stockData.outstanding_buy = inputData.OutstandingBuy
  // stockData.outstanding_sell = inputData.OutstandingSell


  stockData.buy_price_1 = inputData.Bid1Price
  stockData.buy_volumn_1 = inputData.Bid1Volume

  stockData.buy_price_2 = inputData.Bid2Price
  stockData.buy_volumn_2 = inputData.Bid2Volume

  stockData.buy_price_3 = inputData.Bid3Price
  stockData.buy_volumn_3 = inputData.Bid3Volume

  stockData.sell_price_1 = inputData.Offer1Price
  stockData.sell_volumn_1 = inputData.Offer1Volume

  stockData.sell_price_2 = inputData.Offer2Price
  stockData.sell_volumn_2 = inputData.Offer2Volume

  stockData.sell_price_3 = inputData.Offer3Price
  stockData.sell_volumn_3 = inputData.Offer3Volume

  stockData.current_room = inputData.CurrentRoom
  stockData.foreign_buy_vol = inputData.ForeginBuyVolume
  stockData.foreign_sell_vol = inputData.ForeignSellVolume
  return stockData
}



const findCompanyByStockCode = async (stock_code, searchType) => {
  let query = `q=code%3A(${stock_code})%20AND%20search_type%3A${searchType}&wt=json`
  try {
    let result = await client_search_all.search(query)

    // console.log('Response:', result.response.docs);
    return result.response.docs[0]
  } catch (e) {
    console.error(e);
    return null;
  }
}

const updateCompanyByStockCode = async (inputData) => {
  if (!inputData.code) {
    return
  }
  // find exist data
  let companyInfo = await findCompanyByStockCode(inputData.code, inputData.search_type)

  companyInfo = companyInfo ? { ...companyInfo, ...inputData } : { ...inputData }
  // remove version if existed
  delete companyInfo._version_
  // insert or update stock
  try {
    const result = await client_search_all.update(companyInfo, { commit: true })
    console.log('import success stock_code:', companyInfo.code);

  } catch (e) {
    console.log(e)
    console.error('Error when insert solr stockCode:', inputData.code)
  }
}

const importCompany = async (sequelize, sequelizeAcad) => {
  let data = await sequelize.query(`SELECT 
                                      c.code, 
                                      c.name, 
                                      c.short_name,
                                      c.introduction,
                                      c.stock_exchange,
                                      c.name_en,
                                      'COMPANY' search_type
                                    FROM company c
                                    WHERE c.deleted_at is null and stock_exchange <> 'OTC' ORDER BY c.code `,
    {
      type: sequelize.QueryTypes.SELECT
    }
  )
  if (data && data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      let element = data[i]
      await updateCompanyByStockCode(element)
    }
  }

  data = await sequelizeAcad.query(` select code, name, introduction, '' stock_exchange, 
        'KEYWORD' search_type from keyword where deleted is null order by code `,
    {
      type: sequelizeAcad.QueryTypes.SELECT
    }
  )
  if (data && data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      let element = data[i]
      await updateCompanyByStockCode(element)
    }
  }
  return { ...data }
}

const findListAlertInfo = async (sequelize, idCustomer) => {
  let data = await sequelize.query(` select code, (case 
                                                      when is_read = 1 then 1
                                                      else 0
                                                  end) is_read,
                                                 alert_type 
                                      from trading_db.alert_info where deleted_at is NULL and id_customer=:idCustomer `,
    {
      replacements: {
        idCustomer: idCustomer
      }, type: sequelize.QueryTypes.SELECT
    }
  )
  return data
}

module.exports = {
  findOrderTypesTemplates,
  findOrderTypesConfig,
  getDataDealVietStock,
  getDataByDateAndStockCodes,
  getDataByDateAndStockCodesPine,
  getDataWatchList,
  getDataPortfolios,
  getListInfoReportStockByStockExchange,
  importToSolrAllStockInfor,
  importToSolrAllStockInforGoline,
  findOrderTypeByStockExchange,
  // importToSolrReportStock,
  findDetailInforByStockCode,
  findSimpleDetailInforByStockCode,
  findSimpleListDetailInforByListStockCode,
  // findReportByStockCode,
  importAllMarketIndex,
  deleteStockTradingInfoOverMinutes,
  // deleteStockReportTradingInfoOverMinutes,
  getDataMarketIndex,
  findListAlertInfo,
  importDefaultMarketStatus,
  importCompany,
  mongoFindStockCodes
}


