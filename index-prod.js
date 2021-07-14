var fs = require('fs');
var config = require('./config')
const privateKey = fs.readFileSync('apipine.key', 'utf8');
const certificate = fs.readFileSync('apipine.pem', 'utf8');
// const privateKey = fs.readFileSync('sochft.key', 'utf8');
// const certificate = fs.readFileSync('sochft.pem', 'utf8');
const certOption = {
  key: privateKey,
  cert: certificate
};


var compression = require('compression');
const express = require('express')
const app = express();

var http = require('http').Server(app);

var https = require('https');
var httpsServer = https.createServer(certOption, app)
var httpsSocket = https.createServer(certOption, app)
//

var cors = require('cors');
var io = config.isHttp ? require('socket.io').listen(http, { pingInterval: config.pingInterval, pingTimeout: config.pingTimeout, path: '/stockSocket' }) :
  require('socket.io').listen(httpsSocket, { pingInterval: config.pingInterval, pingTimeout: config.pingTimeout, path: '/stockSocket' })
var traddingSocket = require('./socket/TraddingSocket')(io)
var jwt = require('jsonwebtoken');
var path = require('path')
var fs = require('fs')
var rfs = require('rotating-file-stream')
var axios = require('axios');
var tradingService = require('./socket/TraddingService')
const moment = require('moment')

// const io = require('./socket')(http)
var models = require('./models')
const sequelize = require('./sequelize')
const GenerateJWTToken = require('./helpers/GenerateJWTToken')
const firebase = require('firebase-admin')
const serviceAccount = require('./tokenFirebase.json')
var request = require('request-promise');
const schedule = require('node-schedule')
const AuthMiddleware = require('./routers/AuthMiddleware')
const Sequelize = require('sequelize')
const Op = Sequelize.Op
const _ = require('lodash')
const mongoose = require('mongoose')
const CustomerSocketAcad = require('./modelsMongo/CustomerSocketAcad')

//config connection mongodb
mongoose.connect(config.urlMongoDbStock, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true })
const db = mongoose.connection
db.on('error', (error) => console.error(error))
db.once('open', () => console.log('connected to database'))

app.locals.sequelize = sequelize;
app.io = io;
app.locals.io = io;

app.use(compression())
app.use(cors());
app.use('/TradingNodeService', express.static('public'));


app.use(`${config.prefixUrl}/trading`, require('./routers/web/chat'))

const sequelizeAcad = new Sequelize(config.database2.database, config.database2.dbUser, config.database2.dbPassword, {
  host: config.database2.dbHost,
  dialect: config.database2.dbDialect,
  port: config.database2.dbPort,
  define: {
    underscored: true,
    freezeTableName: true,
    paranoid: false,
    timestamps: true,
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  operatorsAliases: false
})
app.locals.sequelizeAcad = sequelizeAcad



//Comment dong nay de bo sync
// models.sequelize.sync().then(function () {

io.use(function (socket, next) {
  socket.sequelize = app.locals.sequelize
  if (socket.handshake.query.socket_type && socket.handshake.query.socket_type === 'PINE_SOCKET') {
    AuthMiddleware.authenticateMiddlePineSocket(socket, next)
  } else {
    AuthMiddleware.authenticateMiddleSocket(socket, next)
  }
})


// Comment dong nay de bo sync
// });

// const importToSolrReportStock = schedule.scheduleJob('* */10 9-12,13-15 * * MON-FRI', async () => {
//   if (!config.isImport) return
//   console.log('========================= start importToSolrReportStock trading=======================')
//   tradingService.importToSolrReportStock()

//   // const { host, port, core } = config.client_stock_trading_report_watchlist
//   // await request(`http://${host}:${port}/solr/admin/cores?action=RELOAD&core=${core}`)
//   console.log('========================= end importToSolrReportStock trading=======================')
// })

const jobPushChannel = schedule.scheduleJob('*/30 * 9-12,13-15 * * MON-FRI', async () => {
  if (!config.isPush) return

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

    for (let i = 0; i < lsCustomerSockets.length; i++) {
      const element = lsCustomerSockets[i];
      // console.log(element);

      let channel = element.channel
      let idSocket = element.idSocket
      let idCustomer = element.idCustomer

      if (!channel || !idSocket) {
        console.log('empty channel or idSocket');
        continue
      }

      if (idCustomer && channel === 'serverSendPortfolios') {
        let data = await tradingService.getDataPortfolios(sequelize, idCustomer)
        console.log('+++++++++++++++++++bat dau chay job channel serverSendPortfolios ++++++++++++++++++++');
        io.to(idSocket).emit('serverSendPortfolios', {
          data
        })
      }
    }
  }

})

app.get('/', function (req, res) {
  res.send('Hello World!')
})

if (config.isHttp) {
  var server = app.listen(config.port, function () {
    console.log('API is listening on port: ' + config.port)
  })
  http.listen(config.socket_port, function () {
    console.log('Socket.io Listening on: ' + config.socket_port);
  })
} else {
  // httpsServer.listen(config.port, () => {
  //   console.log(`API https is listening on port: ${config.port}`);
  // }).setTimeout(1200000);

  var server = app.listen(config.port, function () {
    console.log('API is listening on port: ' + config.port)
  })

  httpsSocket.listen(config.socket_port, () => {
    console.log(`API socket is listening on port: ${config.socket_port}`);
  })
}
