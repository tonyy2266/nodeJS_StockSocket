const jwt = require('jsonwebtoken');
const config = require('../config')

const generateJWTToken = (payload) => {
  return jwt.sign(payload,
    config.jwtKeyAdmin,
    {
      //No need expire
      // expiresIn: config.jwtSessionExpiresTime
    }
  );
}

const decodedJWTToken = (token, callBack) => {
  jwt.verify(token, config.jwtKeyLine, (error, decoded) => {
    callBack(error, decoded)
  })
}

module.exports = {
  generateJWTToken,
  decodedJWTToken
}
