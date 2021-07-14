
const isDev = true
const ipAuService = isDev ? 'http://10.4.20.206:8184' : 'http://10.8.50.207:8081'
const ipPineService = isDev ? 'http://10.4.20.206:8186' : 'http://10.8.50.205:8085'
const ipSolr = {
  host: '10.4.20.210', // '10.8.50.210', // '10.4.20.210',
  port: '8983',
  protocol: 'http'
}

module.exports = {  
  isImport: false,
  isDev: true,
  isPush: false,
  isHttp: true,
  // port: 3666,
  // socket_port: 3777,
  port: 3666,
  socket_port: 3006,
  jwtKeyMobile: '@^$(Ujkdfasjdfjvjk)',
  jwtKeyAdmin: 'KMWKL39578JDKWW',
  jwtKeyLine: 'IMFjdkYY7TTy6RfewQR4PK5jtm0iO32NVslLf3RFv09FN3JLd_9sfdRFOF4xNrQDcNRfVEdTZNOuOyqEGhXEbdJI-ZQ19k_o9MI0y3eZN2fdsfKJH4UNJ8JDJnsdkf90ckVipRLSOkT6kSpzs2x-jbLDiz9iN64kjOAkHjg8kY9Kn-mOmnWMOjbjUh6Rb8BctYKkl4dYfqYWqRNfrgPJVi5DGFjywgPjnBMhgh85F3cF2SGfDR2XwlSkyhhmY-ICjCRmsJN409byYBt6vH4hc43MUG986a18-aQrvyu4j0Os6dMkhig65bGF4fH440nj9IHKHfM15g0Ni89BDSyrrlbcREf9cUsprJgfse43w',
  jwtSessionExpiresTime: '1h',
  algorithm: 'aes256',
  cryptoKey: 'B>x2.6BQ:G-HW,><',
  database2: {
    database: 'academy_db',
    dbUser: 'pinetree_academy',
    dbPassword: 'jA{ejwbq}fa9qRK!',
    dbHost: isDev ? '10.4.20.210' : '10.8.50.210',
    dbDialect: 'mysql',
    dbPort: 3306,
  },
  database: 'trading_db',
  dbUser: 'pinetree_trading',
  dbPassword: 'JA.cE4R6.4!}!(w?',
  dbHost: isDev ? '10.4.20.210' : '10.8.50.210',
  dbDialect: 'mysql',
  page_limit: 10,
  pingInterval: 2000, // ping request moi 2s socket io
  pingTimeout: 10000, // sau 10s bao disconnect khi mat mang,
  pageSize: 10,
  pageSizeChat: 50,
  prefixUrl: '',
  devideConfig: 1000,
  urlToken: `${ipAuService}/oauth/check_token`,
  urlStockBoardGoline: 'http://10.8.22.169:8888/api/GetListStockQuotesByBoard',
  urlMaketIndexVietStock: 'https://api.vietstock.vn/data/markettradinginfo?catid=0',
  urlMaketIndexGoline: 'http://10.8.22.169:8888/api/GetMarketSummary',
  urlImageCompany: 'https://static.pinetree.com.vn/upload/images/companies/',
  urlMongoDbStock: isDev ? 'mongodb://10.4.20.207:27017/stock' : 'mongodb://10.8.50.208:27017/stock',
  urlOrderTemplate: {
    method: 'GET',
    uri: `${ipPineService}/public/order-types-template`,
    headers: {
      'Authorization': `Bearer f945e649-c620-43d1-8e3d-8dff939fea86`
    }
  },
  urlOrderTypesConfig: {
    method: 'GET',
    uri: `${ipPineService}/public/order-types-config`,
    headers: {
      'Authorization': `Bearer f945e649-c620-43d1-8e3d-8dff939fea86`
    }
  },
  urlOptionCheckTradingDay: isDev ? 'http://10.4.20.207:8084/system/check-trading-day?date=' : 'http://10.8.50.207:8081/system/check-trading-day?date=',
  tokenSystemAuth: 'Bearer tZf6VL2Dja9z5b7RtL2ewjfBA33eaGjY5cWGek2TRgF7jFGvLzvuAbJrSdkYdYPx',
  stockExchangeList: 'HOSE,HNX,UPCOM,VN30,HNX30',

  limitMinutes_Keeping_10_minutes: 900000, // 10 minutes
  limitMinutes_Keeping_1day: 86400000 , // 1 day
  solrOptions: {
    ...ipSolr,
    core: 'thucai'
  },
  client_stock_trading_info: {
    ...ipSolr,
    core: 'stock_trading_info'
  },
  client_stock_trading_report_watchlist: {
    ...ipSolr,
    core: 'report_watchlist'
  },
  client_maket_index: {
    ...ipSolr,
    core: 'market_index'
  },
  client_maket_index_goline: {
    ...ipSolr,
    core: 'market_index'
  },
  client_stock_info_line: {
    ...ipSolr,
    core: 'stock_info_line'
  },
  stock_exchange_status: {
    ...ipSolr,
    core: 'stock_exchange_status'
  },
  client_search_all: {
    ...ipSolr,
    core: 'search_all'
  },
}
