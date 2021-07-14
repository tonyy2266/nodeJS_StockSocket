var crypto = require('crypto');
var config = require('../config');
const bcrypt = require('bcryptjs')
const constant = require('../constant')

function encrypt(text) {
    var algorithm = config.algorithm;
    var cryptoKey = config.cryptoKey;
    var cipher = crypto.createCipher(algorithm, cryptoKey);
    var encrypted = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
    return encrypted;
}

function decrypt(text){
    var algorithm = config.algorithm;
    var cryptoKey = config.cryptoKey;
    var encrypted = text;
    var decipher = crypto.createDecipher(algorithm, cryptoKey);
    var decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
    return decrypted;
}

function compareHashedPassword(password, hashedPassword, response) {
    bcrypt.compare(password, hashedPassword, function (err, isMatch) {
        response(err, isMatch);
    });
}

function compareHashedPasswordAsync(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword)
}

function generateHashedPassword(password, response) {
    bcrypt.genSalt(10, function (err, salt) {
        bcrypt.hash(password, salt, function (err, hash) {
            // Store hash in your password DB.
            response(err, hash);
        })
    });
}

function generateHashedPasswordAsync(password) {
    const salt = bcrypt.genSaltSync(10)
    return bcrypt.hashSync(password, salt)
}

function genertateTokenBase64Default() {
    return Buffer.from(`${constant.client_id}:${constant.client_secret}`).toString('base64')
}


module.exports = {
    encrypt,
    decrypt,
    compareHashedPassword,
    compareHashedPasswordAsync,
    generateHashedPassword,
    generateHashedPasswordAsync,
    genertateTokenBase64Default
}