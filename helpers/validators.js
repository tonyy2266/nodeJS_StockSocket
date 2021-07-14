const moment = require('moment')

function validateEmail (email) {
  const regex = /\S+@\S+\.\S+/
  return regex.test(String(email).toLowerCase())
}

function validatePhoneNumber (phoneNumber) {
  const regex = /^\d{10}$|^\d{11}$/
  return regex.test(phoneNumber)
}

function validateZipCode(zipcode) {
  return true
}

function validateDate (value) {
  const date = moment(value, 'DD/MM/YYYY')
  return date.isValid()
}

module.exports = {
  validateEmail,
  validatePhoneNumber,
  validateZipCode
}
