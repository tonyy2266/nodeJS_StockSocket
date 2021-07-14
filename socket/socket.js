
const config = require('../config')
const GenerateJWTToken = require('../helpers/GenerateJWTToken')
const models = require('../models')

module.exports = (http) => {
  const socketio = require('socket.io')

  const io = socketio(http, { pingInterval: config.pingInterval, pingTimeout: config.pingTimeout })

  io.use((socket, next) => {
    const token = socket.handshake.query.token
    GenerateJWTToken.decodedJWTToken(token, (error, decoded) => {
      if (error) {
        next(new Error('authentication error'))
      } else {
        next()
      }
    })
  })

  io.on('connection', (socket) => {
    console.log('có connection đến server')

    const token = socket.handshake.query.token
  
    socket.on('joinRoom', (data) => {
      socket.join(`${data.conversationId}`)
    })
  
    socket.on('clientSendData', (data, callBack) => {
      const { conversationId, message, virtualMessageId } = data
  
      GenerateJWTToken.decodedJWTToken(token, async (error, decoded) => {
        const user = await models.Users.findById(decoded.userId)
        if (user) {
          const newMessageObj = await models.Message.create({
            conversation_id: conversationId,
            senderId: decoded.userId,
            message: message,
            messageType: 'TEXT'
          })
    
          io.to(`${conversationId}`).emit('serverSendData', {
            id: newMessageObj.id,
            messageType: newMessageObj.messageType,
            message,
            email: user.email,
            virtualMessageId
          })

          if (callBack) {
            callBack(virtualMessageId)
          }
        }
      })
    })
  })


  return io
}