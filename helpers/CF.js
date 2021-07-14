var axios = require('axios');
var config = require('../config');
var async = require('async')
var models = require('../models');
// var models = require('../models');
var _ = require('lodash');
var responseCode = require('../ResponseCode');
const multer = require('multer');
const mkdirp = require('mkdirp')
const path = require('path');
const Jimp = require('jimp');
var Chance = require('chance');
var chance = new Chance();
var request = require('request');

function buildResponse(responseCode, responseText) {
    var response = new Object();
    response.ResponseCode = responseCode;
    response.ResponseText = responseText;
    return response;
}

function buildResponseObject({ code, message, data = '' }) {
    return {
        code,
        message,
        data
    }
}

function boDauTiengViet(str) {
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    return str;
}

const renderFileName = (file) => {
    if (_.endsWith(file.mimetype, 'jpeg')) {
        return `${chance.guid()}.jpeg`
    } else if (_.endsWith(file.mimetype, 'jpg')) {
        return `${chance.guid()}.jpg`
    } else if (_.endsWith(file.mimetype, 'png')) {
        return `${chance.guid()}.png`
    } else if (_.endsWith(file.mimetype, 'gif')) {
        return `${chance.guid()}.gif`
    } else if (_.endsWith(file.mimetype, 'pdf')) {
        return `${chance.guid()}.pdf`
    }
}

var storageSingle = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = req.dir;
        mkdirp(dir, (err) => { // tao ra thu muc theo con..Id neu thu muc nay chua co
            if (err) {
                var responseObject = buildResponse(responseCode.ERROR, 'Không thê upload document, vui lòng thử lại');
                res.status(200).send(responseObject);
            } else {
                cb(null, dir);
            }
        })
    },
    filename: function (req, file, cb) {
        var filetypes = /jpg|jpeg|png|gif|pdf/;
        var mimetype = filetypes.test(file.mimetype);
        var extname = filetypes.test(path.extname(file.originalname));
        if (mimetype || extname) {
            var fileName = renderFileName(file);
            cb(null, fileName);
        } else {
            cb('Định dạng không hỗ trợ');
        }
    }
});

var uploadForSingle = multer({ storage: storageSingle }).array('files', 1);

var uploadForMulti = multer({ storage: storageSingle }).any();

var uploadForSingleArtical = multer({ storage: storageSingle }).array('upload', 1);

exports.uploadSingleImage = function uploadSingleImage(req, res, callback) {
    uploadForSingle(req, res, function (err) {
      console.log('test', req.files)
        if (err || !req.files || req.files.length === 0) {
            callback(false, err == null ? 'Không có ảnh tải lên' : err, '')
        } else {
            const filename = req.files[0].filename;
            Jimp.read(req.dir + filename).then(function (lenna) {
                var width = lenna.bitmap.width; // the width of the image
                var height = lenna.bitmap.height; // the height of the image
                if (width > height && width > 900) {
                    width = 900;
                    height = Jimp.AUTO;
                } else if (height > width && height > 900) {
                    width = Jimp.AUTO;
                    height = 900;
                }
                /////////////////////////// resize anh nho lai
                lenna.resize(width, height)
                    .quality(90)                 // set JPEG quality
                    .write(req.dir + filename); // save
                //////////////////////////// luu lai anh thumb
                mkdirp(req.dirThumb, (err) => { // tao ra thu muc theo con..Id neu thu muc nay chua co
                    if (err) {
                        callback(true, err, '');
                    } else {
                        if (width === -1 || height === -1) { // neu width dang la auto thi no se la -1
                            width = width === -1 ? Jimp.AUTO : 300;
                            height = height === -1 ? Jimp.AUTO : 300;
                        } else { // neu height la auto
                            if (width > height && width > 300) {
                                width = 300;
                                height = Jimp.AUTO;
                            } else if (height > width && height > 300) {
                                width = Jimp.AUTO;
                                height = 300;
                            }
                        }
                        lenna.resize(width, height)
                            .quality(80)                 // set JPEG quality
                            .write(req.dirThumb + filename); // save
                        /////////////////////////////
                        callback(false, 'Success', filename)
                    }
                })
            }).catch(function (err) {
                console.log('------------err---------------');
                console.log(err);
                callback(true, err, '');
            });
        }
    })
}


// send to device
exports.PushNotificationsUsingFirebaseAdminWithData = function PushNotificationsUsingFirebaseAdminWithData(req, title, body, data, fcmIds) {
    const admin = req.app.locals.admin;
    const custom_data_config = {
        show_in_foreground: true,
        click_action: 'OPEN_ACTIVITY',
        sound: 'default',
        title: title,
        body: body,
        priority: 'high',
        auto_cancel: true,
        icon: 'ic_logo',
        large_icon: 'ic_logo',
        contentAvailable: true,
        vibrate: 300,
        lights: true
    }
    //
    const resp = { data }
    Object.assign(resp, custom_data_config);
    const payload = {
        notification: {
            title: title,
            click_action: "OPEN_ACTIVITY",
            body: body,
            content_available: 'true',
            icon: 'ic_logo',
            large_icon: 'ic_logo',
            sound: "default",
        },
        data: {
            type: "MEASURE_CHANGE",
            custom_notification: JSON.stringify(resp)
        }
    }
    return new Promise((resolve, reject) => {
        if (fcmIds && fcmIds != '') {
            admin.messaging().sendToDevice(fcmIds, payload)
                .then(function (response) {
                    resolve(response)
                    console.log(response);
                    console.log('--------------------ban thong bao feedback--------------------');
                })
                .catch(function (error) {
                    reject(error);
                    console.log(error);
                });
        }
    })
}

// send to topic
exports.PushNotificationsTopicUsingFirebaseAdminWithData = function PushNotificationsTopicUsingFirebaseAdminWithData(req, title, body, data, topicName) {
    const admin = req.app.locals.admin;
    const custom_data_config = {
        show_in_foreground: true,
        click_action: 'OPEN_ACTIVITY',
        sound: 'default',
        title: title,
        body: body,
        priority: 'high',
        auto_cancel: true,
        icon: 'ic_logo',
        large_icon: 'ic_logo',
        contentAvailable: true,
        vibrate: 300,
        lights: true
    }
    //
    const resp = { data }
    Object.assign(resp, custom_data_config);
    const payload = {
        notification: {
            title: title,
            click_action: "OPEN_ACTIVITY",
            body: body,
            content_available: 'true',
            icon: 'ic_logo',
            large_icon: 'ic_logo',
            sound: "default",
        },
        data: {
            type: "MEASURE_CHANGE",
            custom_notification: JSON.stringify(resp)
        }
    }
    return new Promise((resolve, reject) => {
        if (topicName && topicName != '') {
            const topic = boDauTiengViet('/topics/' + topicName);
            admin.messaging().sendToTopic(topic, payload).then(function (response) {
                resolve(response)
                console.log(response);
                console.log('--------------------ban thong bao feedback topic--------------------');
            }).catch(function (error) {
                reject(error);
                console.log(error);
            });
        }
    })
}


exports.SubscribeFcmIdToTopic = function SubscribeFcmIdToTopic(req, fcmIds, topic, phoneNumber, callback) {
    var admin = req.app.locals.admin;
    topic = boDauTiengViet(topic)
    // Subscribe the device corresponding to the registration token to the
    // topic. max subscribe is 1000 so we need to split
    if (fcmIds && fcmIds.length > 0) {
        admin.messaging().subscribeToTopic(fcmIds, topic)
            .then(function (response) {
                // See the MessagingTopicManagementResponse reference documentation
                // for the contents of response.
                console.log('----------------------------');
                console.log('SubscribeFcmIdToTopic: ' + topic);
                console.log(response);
                var indexToRemove = [];
                if (response.failureCount > 0) {
                    async.everySeries(response.errors, function (error, callbackError) {
                        indexToRemove.push(error.index);
                        console.log(error.error)
                        callbackError(null, true);
                    }, (err) => {
                        _.pullAt(fcmIds, indexToRemove); // Xoa cac fcm id bi loi ra khoi mang fcm ids
                        //Cap nhat vao db
                        // models.Parent.update(
                        //     { fcmIds: fcmIds },
                        //     { where: { phoneNumber: phoneNumber } }
                        // ).then(numberOfRowUpdated => {
                        //     console.log('FcmIds: ');
                        //     console.log(fcmIds)
                        // })
                    });
                }
                callback(response)
            })
            .catch(function (error) {
                // console.log('----------------------------');
                // console.log('SubscribeFcmIdToTopic: ' + topic);
                // console.log(fcmIds);
                console.log(error)
                console.log('----------------------------');
                callback(error)
            });
    } else {
        callback('FCMID is NULL')
    }
}

exports.UnSubscribeFcmIdToTopic = function UnSubscribeFcmIdToTopic(req, fcmIds, topic, callback) {
    var admin = req.app.locals.admin;
    topic = boDauTiengViet(topic);
    // Subscribe the device corresponding to the registration token to the
    // topic. max subscribe is 1000 so we need to split
    if (fcmIds && fcmIds.length > 0) {
        admin.messaging().unsubscribeFromTopic(fcmIds, topic)
            .then(function (response) {
                // See the MessagingTopicManagementResponse reference documentation
                // for the contents of response.
                console.log('----------------------------');
                console.log('UnSubscribeFcmIdToTopic: ' + topic);
                console.log('FcmIds: ');
                console.log(fcmIds);
                console.log(response)
                // console.log(response.errors[0].error)
                // console.log('----------------------------');
                callback(response)
            }).catch(function (error) {
                // console.log('----------------------------');
                // console.log('UnSubscribeFcmIdToTopic: ' + topic);
                console.log('Loiii: ');
                // console.log(fcmIds);
                console.log(error)
                console.log('----------------------------');
                callback(error)
            });
    } else {
        callback('FCMID is NULL')
    }
}


exports.checkLength255 = function checkLength255(input, text) {
    if (input.length == 0) {
        return text + ' không được để trống';
    } else if (input.length > 255) {
        return text + ' không được dài quá 255 ký tự';
    } else {
        return '';
    }
}

exports.lastIndex = function lastIndex(page, limit) {
    return (_.toNumber(page) - 1) * limit
}

exports.getLimitOffset = function getLimitOffset(page, pageSize, totalRow) {
    const mPageSize = pageSize ? pageSize : config.pageSize;
    const mPage = page ? parseInt(page) : 1
    var offset = (_.toNumber(mPage) - 1) * mPageSize;
    var totalPages = Math.ceil(totalRow / mPageSize);

    return {
        limit: mPageSize,
        offset: offset,
        totalPages: totalPages,
        totalElements: totalRow,
        page: mPage,
        pageSize: mPageSize
    }
}

exports.doRequest = function doRequest(url) {
    return new Promise(function (resolve, reject) {
      request(url, function (error, res, body) {
        if (!error && res.statusCode == 200) {
          resolve(JSON.parse(body))
        } else {
          reject(error);
        }
      });
    });
}

function array_move(arr, old_index, new_index) {
    if (new_index >= arr.length) {
        var k = new_index - arr.length + 1;
        while (k--) {
            arr.push(undefined);
        }
    }
    arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
    return arr; // for testing
}


exports.buildResponse = buildResponse;
exports.buildResponseObject = buildResponseObject
exports.boDauTiengViet = boDauTiengViet;
exports.uploadForSingle = uploadForSingle;
exports.uploadForSingleArtical = uploadForSingleArtical
exports.uploadForMulti = uploadForMulti
exports.array_move = array_move