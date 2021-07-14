const models = require('../models')
const moment = require('moment');
const config = require('../config');
const _ = require('lodash');
var request = require('request')
const Sequelize = require('sequelize')
const Op = Sequelize.Op
var traddingService = require('./TraddingService')
const CustomerSocketAcad = require('../modelsMongo/CustomerSocketAcad')

exports = module.exports = function (io) {
    io.sockets.on('connection', async (socket) => {
        // console.log(socket.id);
        // console.log(socket.idCustomer);

        console.log('chay vao connection =====================');

        socket.on('disconnectManually', () => {
            socket.disconnect()
        })

        socket.on('disconnect', async () => {
            console.log('user disconnect ===>', socket.id)
            CustomerSocketAcad.deleteOne({ idSocket: socket.id }, (err) => {
                if (err) throw err
            })
        })

        socket.on('disconnectServerSendInfoStock', async () => {
            if (socket.idCustomer) {
                // models.CustomerSocket.destroy(
                //     { where: { idCustomer: socket.idCustomer, channel: 'serverSendInfoStock' } })
            }
        })

        socket.on('disconnectServerSendPortfolios', async () => {
            if (socket.idCustomer) {
                CustomerSocketAcad.deleteMany({ idCustomer: socket.idCustomer, channel: 'serverSendPortfolios' }, (err) => {
                    if (err) throw err
                })
            }
        })

        socket.on('disconnectServerSendWatchList', async () => {
            if (socket.idCustomer) {
                // models.CustomerSocket.destroy(
                //     { where: { idCustomer: socket.idCustomer, channel: 'serverSendWatchList' } })
            }
        })

        socket.on('disconnectServerSendInfoStockPine', async () => {
            // models.CustomerSocket.destroy(
            //     { where: { channel: 'serverSendInfoStockPine', idSocket: socket.id } })
        })

        socket.on('clientRequestInfoByStockCodes', async (input) => {
            if (input && input.stockCode && input.date && socket.idCustomer) {
                // console.log('----------not found stockCode, date or idCustomer--------------')
                console.log('-------------mo ket noi voi clientRequestInfoByStockCodes--------- ')
                // models.CustomerSocket
                //     .findOrCreate({
                //         where: { idCustomer: socket.idCustomer, channel: 'serverSendInfoStock' }, defaults: {
                //             idCustomer: socket.idCustomer,
                //             channel: 'serverSendInfoStock',
                //             idSocket: socket.id,
                //             stockCode: input.stockCode
                //         }
                //     })
                //     .spread((data, created) => {
                //         if (created) {
                //             console.log('create channel clientRequestInfoByStockCodes success');
                //         } else {
                //             models.CustomerSocket.update({
                //                 idSocket: socket.id,
                //                 stockCode: input.stockCode
                //             }, { where: { id: data.id } })
                //         }
                //     })

                console.log('create clientRequestInfoByStockCodes success ');

                const data = await traddingService.getDataByDateAndStockCodes(socket.sequelize, input.stockCode, socket.idCustomer)
                // console.log(data)

                // io.to(socket.id).emit(`serverSendInfoStock`, {
                //     data
                // })
                // start de tam chay 2 phien ban thanhnt
                io.to(socket.id).emit(`serverSendInfoStock2`, {
                    data
                })
                // end de tam chay 2 phien ban thanhnt
            }
        })

        socket.on('clientRequestInfoByStockCodesPine', async (input) => {
            if (input && input.stockCode) {
                // console.log('----------not found stockCode, date or idCustomer--------------')
                console.log('-------------mo ket noi voi clientRequestInfoByStockCodesPine--------- ')

                // const where = {
                //     guid: socket.guid,
                //     channel: 'serverSendInfoStockPine',
                //     idCustomerPine: null
                // }
                // const defaults = {
                //     guid: socket.guid,
                //     channel: 'serverSendInfoStockPine',
                //     idSocket: socket.id,
                //     stockCode: input.stockCode
                // }

                // if (socket.idCustomerPine) {

                //     defaults.idCustomerPine = socket.idCustomerPine

                //     where.idCustomerPine = socket.idCustomerPine
                // }

                // models.CustomerSocket
                //     .findOrCreate({ where, defaults })
                //     .spread((data, created) => {
                //         if (created) {
                //             console.log('create channel serverSendInfoStockPine success');
                //         } else {
                //             models.CustomerSocket.update({
                //                 idSocket: socket.id,
                //                 stockCode: input.stockCode
                //             }, { where: { id: data.id } })
                //         }
                //     })

                console.log('create clientRequestInfoByStockCodesPine success ');

                const data = await traddingService.getDataByDateAndStockCodesPine(socket.sequelize, input.stockCode)
                // console.log(data)

                // io.to(socket.id).emit(`serverSendInfoStockPine`, {
                //     data
                // })
                // start de tam chay 2 phien ban thanhnt
                io.to(socket.id).emit(`serverSendInfoStockPine2`, {
                    data
                })
                // end de tam chay 2 phien ban thanhnt
            }
        })

        socket.on('clientRequestPortfolios', async () => {
            if (socket.idCustomer) {
                // console.log('--------clientRequestPortfolios date, idCustomer is not empty-------- ')
                console.log('mo ket noi voi clientRequestPortfolios');
                CustomerSocketAcad.findOneAndUpdate({ idCustomer: socket.idCustomer, channel: 'serverSendPortfolios' }, {
                    idCustomer: socket.idCustomer,
                    channel: 'serverSendPortfolios',
                    idSocket: socket.id
                }, { upsert: true }, (err) => {
                    if (err) throw err
                    console.log('=============them clientRequestPortfolios thanh cong');
                })

                console.log('create serverSendPortfolios success ');
                const data = await traddingService.getDataPortfolios(socket.sequelize, socket.idCustomer)
                // console.log(data)
                io.to(socket.id).emit(`serverSendPortfolios`, {
                    data
                })
            }

        })

        socket.on('clientRequestWatchList', async (input) => {
            if (input && input.date && socket.idCustomer) {
                // console.log('clientRequestWatchList date is not empty ')
                console.log('mo ket noi voi clientRequestWatchList');
                // models.CustomerSocket
                //     .findOrCreate({
                //         where: { idCustomer: socket.idCustomer, channel: 'serverSendWatchList' }, defaults: {
                //             idCustomer: socket.idCustomer,
                //             channel: 'serverSendWatchList',
                //             idSocket: socket.id
                //         }
                //     })
                //     .spread((data, created) => {
                //         if (created) {
                //             console.log('create channel serverSendWatchList success');
                //         } else {
                //             models.CustomerSocket.update({ idSocket: socket.id }, { where: { id: data.id } })
                //         }
                //     });
                console.log('create serverSendWatchList success ');
                const data = await traddingService.getDataWatchList(socket.sequelize, socket.idCustomer)
                // console.log(data)
                // io.to(socket.id).emit(`serverSendWatchList`, {
                //     data
                // })
                // start de tam chay 2 phien ban thanhnt
                io.to(socket.id).emit(`serverSendWatchList2`, {
                    data
                })
                // end de tam chay 2 phien ban thanhnt
            }
        })
        /* Thanhnt  comment tam vao de choc vao moi truong production
        socket.on('clientRequestAlertInfo', async () => {
            console.log('vao socket clientRequestAlertInfo =========================');
            if (socket.idCustomer) {
                const data = await traddingService.findListAlertInfo(socket.sequelize, socket.idCustomer)
    
                models.CustomerSocket
                        .findOrCreate({
                            where: { idCustomer: socket.idCustomer, channel: 'serverSendAlertInfo' }, defaults: {
                                idCustomer: socket.idCustomer,
                                channel: 'serverSendAlertInfo',
                                idSocket: socket.id
                            }
                        })
                        .spread((data, created) => {
                            if (created) {
                                console.log('create channel serverSendWatchList success');
                            } else {
                                models.CustomerSocket.update({ idSocket: socket.id }, { where: { id: data.id } })
                            }
                        })
    
                io.to(socket.id).emit(`serverSendAlertInfo`, {
                    data
                })
            }
        })
        */
        // start de tam chay 2 phien ban thanhnt
        // let lsMarket = await traddingService.getDataMarketIndex(false)

        // io.to(socket.id).emit(`serverSendMarketIndex`, {
        //     data: lsMarket
        // })

        // for (let i = 0; i < lsMarket.length; i++) {
        //     const element = lsMarket[i];
        //     // console.log('test:', element.market_code_name);
        //     io.emit(`serverSend${element.market_code_name}`, {
        //         data: element
        //     })
        // }
        // end de tam chay 2 phien ban thanhnt


    })
}