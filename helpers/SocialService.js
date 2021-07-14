const request = require('request-promise')
var _ = require('lodash')

const getSocialFacebook = async (req, res) => {
  const { socialToken } = req.body
  const fields = 'id,name,first_name,middle_name,last_name,email,gender'

  const options = {
    method: 'GET',
    uri: 'https://graph.facebook.com/v2.8/me',
    qs: {
      access_token: socialToken,
      fields
    }
  }

  let result = {}

  await request(options).then(response => {
    const fb = JSON.parse(response)
    if (fb) {
      if (fb.id) {
        result.socialToken = socialToken
        result.socialType = 'facebook'
        result.socialUserId = fb.id
        result.name = fb.name
        result.email = fb.email
        result.firstName = fb.first_name
        result.lastName = fb.last_name
      }
    }
  }).catch((err) => {
    console.log('Có lỗi xảy ra khi load thông tin server facebook')
  })

  return result
}

const getSocialGoogle = async (req, res) => {
  const { socialToken } = req.body
  const options = {
    method: 'GET',
    uri: 'https://www.googleapis.com/oauth2/v2/userinfo',
    headers: {
      'Authorization': `Bearer ${socialToken}`
    }
  }

  let result = {}
  await request(options).then(response => {
    const google = JSON.parse(response)
    if (google && google.id) {
      result.socialToken = socialToken
      result.socialType = 'google'
      result.socialUserId = google.id
      result.name = google.name
      result.email = google.email
    }
  }).catch((err) => {
    console.log('Có lỗi xảy ra khi load thông tin server google')
  })
  return result
}

const getSociaLinkedIn = async (req, res) => {
  const { socialToken } = req.body
  const options = {
    method: 'GET',
    uri: 'https://api.linkedin.com/v1/people/',
    headers: {
      'Authorization': `Bearer ${socialToken}`
    }
  }
  let result = {}
  await request(options)
    .then(response => {
      if (response) {
        const linkedin = JSON.parse(response)
        result.socialUserId = linkedin.id
        result.socialToken = socialToken
        result.socialType = 'linkedin'
      }
    }).catch((err) => {
      cconsole.log('Có lỗi xảy ra khi load thông tin server linkedin')
    })
  return result
}

const validateSocialAccount = async (req, res) => {
  const social = req.body
  const socialType = social && social.socialType ? (await _.lowerCase(social.socialType)) : ''
  const socialUserId = social && social.socialUserId ? social.socialUserId : ''
  let isValidSocial = false
  let result = {}
  if (socialType) {
    switch (socialType) {
      case 'facebook':
        const facebook = await getSocialFacebook(req, res)
        isValidSocial = facebook && facebook.socialUserId !== '' && facebook.socialUserId === socialUserId
        result = {... facebook}
        break
      case 'google':
        const google = await getSocialGoogle(req, res)
        isValidSocial = google && google.socialUserId !== '' && google.socialUserId === socialUserId
        result = {... google}
        break
      case 'linkedin':
        const linkedin = await getSociaLinkedIn(req, res)
        isValidSocial = linkedin && linkedin.socialUserId !== '' && linkedin.socialUserId === socialUserId
        result = {... linkedin}
        break
      default:
        isValidSocial = false
        break
    }
  }
  result.isValidSocial = isValidSocial
  return result
}


module.exports = {
  getSocialFacebook,
  getSocialGoogle,
  getSociaLinkedIn,
  validateSocialAccount,
}