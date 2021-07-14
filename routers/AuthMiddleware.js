
var jwt = require('jsonwebtoken');
var config = require('../config');
var cf = require('../helpers/CF');
var responseCode = require('../ResponseCode');
var models = require('../models');
var request = require('request')
var Encryption = require('../helpers/Encryption')
const GenerateJWTToken = require('../helpers/GenerateJWTToken')

function getOptionsAuthen(token) {
    console.log(`socket token tung send: ${token}`)
    return {
        url: config.urlToken,
        headers: {
            'Authorization': `Basic ${Encryption.genertateTokenBase64Default()}`
        },
        form: {
            token: token
        }
    }
}

function authenticateMiddleCustomer(req, res, next) {
    let token = req.headers['authorization']

    if (!token) {
        return res.status(403).send(cf.buildResponseObject({
            code: responseCode.NOT_AUTH,
            message: 'Token invalid'
        }));
    }

    token = token.indexOf('Bearer') >= 0 ? token.split(' ')[1] : token

    let options =  getOptionsAuthen(token)

    request.post(options, function (error, response, body) {
        if (error || response.statusCode && response.statusCode >= 400) {
            return res.status(403).send(cf.buildResponseObject({
                code: responseCode.NOT_AUTH,
                message: 'Token invalid'
            }));
        }
        let data = JSON.parse(body)
        req.idCustomer = data.extra_id
        req.email = data.extra_email
        next()
    })
}

function authenticateMiddleSocket(socket, next) {
    const token = socket.handshake.query.token

    // console.log('-------------token dang nhap socket:--------------------', token);

    let options = getOptionsAuthen(token)

    // console.log(options);
    // console.log('-------------options socket:--------------------', options);

    request.post(options, function (error, response, body) {
        // console.log(response);
        if (error || response.statusCode && response.statusCode >= 400) {
            next(new Error('authentication error'))
        }
        // console.log(body);
        // console.log('-------------body socket:--------------------', body);

        let data = JSON.parse(body)
        console.log('idCustomer:' , data.extra_id, '-------- email: ', data.extra_email)
        socket.idCustomer = data.extra_id
        socket.email = data.extra_email
        next()
    })
}

function authenticateMiddlePineSocket(socket, next) {
    const guid = socket.handshake.query.guid
    const token = socket.handshake.query.token
    socket.guid = guid
    console.log('============================= guid:', socket.guid);
    if (token) {
        GenerateJWTToken.decodedJWTToken(token, (error, decoded) => {
            if (error) {
                next(new Error('authentication error'))
            } else {
                socket.idCustomerPine = decoded.idCustomer
                socket.sessionId = decoded.sessionId
                console.log('============================= idCustomer:', socket.idCustomerPine);
                console.log('============================= sessionId:', socket.sessionId);
                next()
            }
        })
    } else if (guid) {
        next()
    }
}

function authenticateMiddleware(req, res, next) {
    var token = req.headers['authorization'];
    var key = config.jwtKeyAdmin;
    let baseUrl = req.baseUrl

    if (token && token != 'null') {
        jwt.verify(token, key, async (error, decoded) => {
            if (error) {
                console.log('=======Token Errros========', error.name)
                if (error.name === 'TokenExpiredError') {
                    res.status(403).send(cf.buildResponseObject({
                        code: responseCode.JWT_TIMED_OUT,
                        message: 'Token Expried'
                    }))
                } else if (error.name === "JsonWebTokenError") {
                    //sai key
                    res.status(403).send(cf.buildResponseObject({
                        code: responseCode.NOT_AUTH,
                        message: 'Token decode failed.'
                    }));
                } else {
                    res.status(403).send(cf.buildResponseObject({
                        code: responseCode.NOT_AUTH,
                        message: 'Token decode failed.'
                    }));
                }
            } else {
                // console.log('decoded =====> ', decoded)
                if (!decoded.permission || decoded.permission.length === 0) {
                    return res.status(403).send(cf.buildResponseObject({
                        code: responseCode.NOT_AUTH,
                        message: 'Not permision'
                    }));
                }
                // console.log(baseUrl)
                if (baseUrl) {
                    let urlPermision = baseUrl.split('/')
                    urlPermision = urlPermision && urlPermision.length > 1 ? urlPermision[1] : null
                    if (!urlPermision) {
                        return res.status(403).send(cf.buildResponseObject({
                            code: responseCode.NOT_AUTH,
                            message: 'Not permision'
                        }));

                    }
                    if (decoded && decoded.permission) {
                        if (urlPermision === 'client' && decoded.permission.indexOf('CUSTOMER') < 0
                            || urlPermision === 'coach' && decoded.permission.indexOf('COACH') < 0
                            || urlPermision === 'admin' && decoded.permission.indexOf('ADMIN') < 0
                            || urlPermision === 'web' && decoded.permission.indexOf('CUSTOMER') < 0
                            && decoded.permission.indexOf('COACH') < 0
                            && decoded.permission.indexOf('ADMIN') < 0) {
                            return res.status(403).send(cf.buildResponseObject({
                                code: responseCode.NOT_AUTH,
                                message: 'Not permision'
                            }));
                        }
                    }

                }
                //validate projectId
                try {
                    const body = req.body
                    let projectId = req.projectId
                    if (req.params && req.params.projectId && req.params.projectId > 0) {
                        projectId = req.params.projectId
                    }
                    if (body && body.projectId && body.projectId > 0) {
                        projectId = body.projectId
                    }
                    if (req.query && req.query.projectId && req.query.projectId > 0) {
                        projectId = req.query.projectId
                    }
                    if (projectId) {
                        const projectDB = await models.Project.findOne({ where: { id: projectId } })
                        if (!projectDB) {
                            return res.status(403).send(cf.buildResponseObject({
                                code: responseCode.NOT_AUTH,
                                message: 'Project is not existed.'
                            }));
                        }
                        if (projectDB.clientId !== decoded.userId && projectDB.coachId !== decoded.userId) {
                            return res.status(403).send(cf.buildResponseObject({
                                code: responseCode.NOT_AUTH,
                                message: 'You are not allowed to update this project.'
                            }));
                        }
                    }
                } catch (e) {
                    console.log("ERROR happened while checking project: " + e)
                }
                if (!decoded.permission || decoded.permission.length === 0) {
                    return res.status(403).send(cf.buildResponseObject({
                        code: responseCode.NOT_AUTH,
                        message: 'Not permision'
                    }));
                }
                //kiem tra neu coach bi lock thi bao loi
                if (decoded.permission.indexOf('COACH') >= 0) {
                    const userCoach = await models.Users.findOne({ where: { id: decoded.userId } })
                    if (userCoach && userCoach.status !== 'ACCEPT') {
                        return res.status(403).send(cf.buildResponseObject({
                            code: responseCode.NOT_AUTH,
                            message: `Coach's status is not active`
                        }));
                    }
                }
                //end validate projectid
                req.lang = decoded.lang ? decoded.lang : 'en';
                req.userId = decoded.userId;
                req.email = decoded.email;
                req.permission = decoded.permission;
                next()
            }
        })
    } else {
        res.status(200).send(cf.buildResponseObject({
            code: responseCode.ERROR,
            message: 'No token provided. '
        }))
    }
}

const authenticateMiddlewareAdmin = async (req, res, next) => {
    var token = req.headers['authorization'];
    var key = config.jwtKeyAdmin;

    if (token && token != 'null') {
        jwt.verify(token, key, async (error, decoded) => {
            if (error) {
                console.log('=======Token Errros========', error.name)
                if (error.name === 'TokenExpiredError') {
                    res.status(403).send(cf.buildResponseObject({
                        code: responseCode.JWT_TIMED_OUT,
                        message: 'Token Expried'
                    }))
                } else if (error.name === "JsonWebTokenError") {
                    //sai key
                    res.status(403).send(cf.buildResponseObject({
                        code: responseCode.NOT_AUTH,
                        message: 'Token decode failed.'
                    }));
                } else {
                    res.status(403).send(cf.buildResponseObject({
                        code: responseCode.NOT_AUTH,
                        message: 'Token decode failed.'
                    }));
                }
            } else {
                let user = await models.Users.findById(decoded.userId)

                if (!user) {
                    return res.status(400).send(cf.buildResponseObject({
                        code: responseCode.ERROR,
                        message: 'Not found user'
                    }));
                }
                user = user.get({ plain: true })
                if (user && user.groupId !== 'ADMIN') {
                    return res.status(403).send(cf.buildResponseObject({
                        code: responseCode.NO_PERMISSION,
                        message: 'Permision invalid'
                    }));
                }
                req.lang = decoded.lang ? decoded.lang : 'en';
                req.userId = decoded.userId;
                req.email = decoded.email;
                req.permission = decoded.permission;
                next()
            }
        })
    } else {
        res.status(200).send(cf.buildResponseObject({
            code: responseCode.ERROR,
            message: 'No token provided. '
        }))
    }
}

function AuthMiddleware(req, res, page, next) {
    // check header or url parameters or post parameters for1token
    var token = req.headers['x-access-token'];
    var key = config.jwtKeyAdmin;

    // decode token
    if (token) {
        // verifies secret and checks exp
        jwt.verify(token, key, function (err, decoded) {
            if (err) {
                if (err.name === "TokenExpiredError") {
                    //het session
                    res.send(cf.buildResponse(responseCode.JWT_TIMED_OUT, 'Session timed out.'));
                } else if (err.name === "JsonWebTokenError") {
                    //sai key
                    res.send(cf.buildResponse(responseCode.NOT_AUTH, 'Token decode failed.'));
                }
            } else { // check quyền
                if (decoded.permission[page] && decoded.permission[page].view == 1) {
                    req.decoded = decoded.username;
                    req.permission = decoded.permission[page];
                    req.fullPermisson = decoded.permission;
                    req.user = decoded;
                    console.log('----------------------------');
                    console.log(decoded.permission[page]);
                    next();
                } else {
                    var response = cf.buildResponse(responseCode.NO_PERMISSION, 'Permission denied.');
                    console.log('Permission denied.')
                    return res.status(403).send(response);
                }
            }
        });

    } else {
        // if there is no token
        // return an error
        var response = cf.buildResponse(responseCode.ERROR, 'No token provided.');
        return res.status(403).send(response);
    }
}


function AuthMiddlewareMobile(req, res, next) {
    // check header or url parameters or post parameters for token
    var token = req.headers['x-access-token'];
    var key = config.jwtKeyMobile;
    

    // decode token
    if (token) {
        // verifies secret and checks exp
        jwt.verify(token, key, function (err, decoded) {

            if (err) {
                if (err.name === "TokenExpiredError") {
                    //het session
                    res.send(cf.buildResponse(responseCode.JWT_TIMED_OUT, 'Session timed out.'));
                } else if (err.name === "JsonWebTokenError") {
                    //sai key
                    res.send(cf.buildResponse(responseCode.NOT_AUTH, 'Token decode failed.'));
                }
            } else {
                if (decoded.phoneNumber) {
                    req.decoded = decoded.phoneNumber;
                } else {
                    req.decoded = decoded.teacherId
                }
                next();
            }
        });

    } else {
        // if there is no token
        // return an error
        var response = cf.buildResponse(responseCode.ERROR, 'No token privided.');
        return res.status(403).send(response);
    }
}

function PermissionView(req, res, next) {
    if (req.permission.view == 1) {
        next();
    } else {
        var response = cf.buildResponse(responseCode.NO_PERMISSION, 'Permission denied.');
        console.log('Permission denied.')
        return res.status(403).send(response);
    }
}

function PermissionAdd(req, res, next) {
    if (req.permission.add == 1) {
        next();
    } else {
        var response = cf.buildResponse(responseCode.NO_PERMISSION, 'Permission denied.');
        console.log('Permission denied.')
        return res.status(403).send(response);
    }
}

function PermissionEdit(req, res, next) {
    if (req.permission.edit == 1) {
        next();
    } else {
        var response = cf.buildResponse(responseCode.NO_PERMISSION, 'Permission denied.');
        console.log('Permission denied.')
        return res.status(403).send(response);
    }
}

function PermissionDelete(req, res, next) {
    if (req.permission.delete == 1) {
        next();
    } else {
        var response = cf.buildResponse(responseCode.NO_PERMISSION, 'Permission denied.');
        console.log('Permission denied.')
        return res.status(403).send(response);
    }
}

function PermissionExcelImport(req, res, next) {
    if (req.permission.import == 1) {
        next();
    } else {
        var response = cf.buildResponse(responseCode.NO_PERMISSION, 'Permission denied.');
        console.log('Permission denied.')
        return res.status(403).send(response);
    }
}

function PermissionExcelExport(req, res, next) {
    if (req.permission.export == 1) {
        next();
    } else {
        var response = cf.buildResponse(responseCode.NO_PERMISSION, 'Permission denied.');
        console.log('Permission denied.')
        return res.status(403).send(response);
    }
}


module.exports = {
    authenticateMiddleware,
    authenticateMiddlePineSocket,
    authenticateMiddlewareAdmin,
    PermissionView,
    PermissionAdd,
    PermissionEdit,
    PermissionDelete,
    AuthMiddleware,
    AuthMiddlewareMobile,
    authenticateMiddleCustomer,
    authenticateMiddleSocket
}