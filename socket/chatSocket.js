const models = require('../models')
const moment = require('moment');
const config = require('../config');
const _ = require('lodash');
const notificationConst = require('../notificationConst');

exports = module.exports = function (io) {
    let traddingData

    io.sockets.on('connection', function (socket) {
        console.log(socket.id);
        console.log(socket.userId);

        models.UserSockets.create({
          userId: socket.userId,
          socketId: socket.id
        });

        socket.on('getMyUserId', function (data) {c
            console.log('GET MY USER ID');
            socket.emit('getMyUserId', {
                userId: socket.userId,
                socketId: socket.id
            });
            models.UserSockets.update(
                { type: data.type },
                { where: { socketId: socket.id } }
            )
        });

        socket.on('disconnectManually', () => {
          socket.disconnect()
        })

        socket.on('disconnect', function () {
          console.log('user disconnect ===>', socket.id)
            models.UserSockets.destroy({
                where: {
                    socketId: socket.id
                }
            })
        });

        socket.on('getMessages', async function (data) {
            const page = data.page;
            const conversationId = data.conversationId;
            const pageSize = config.pageSizeChat;

            var offset = (_.toNumber(page) - 1) * pageSize;
            var sequelize = socket.sequelize;
            const totalElementResult = await sequelize.query(` select count(1) total from "Message"
              where "conversationId" = ?
            `, { replacements: [conversationId], type: sequelize.QueryTypes.SELECT })
            const totalElements = totalElementResult && totalElementResult.length > 0 ? parseInt(totalElementResult[0].total) : 0
            let totalPages = 0
            if (totalElements % pageSize > 0) {
              totalPages = Math.floor(totalElements / pageSize) + 1;
            } else {
                totalPages = Math.floor(totalElements / pageSize);
            }
            
            var messages = await sequelize.query(`SELECT * FROM "Message"
            WHERE "conversationId" = ?
            ORDER BY "messageTime" DESC
            OFFSET ? LIMIT ?`,
                { replacements: [conversationId, offset, pageSize], type: sequelize.QueryTypes.SELECT }
            );

            messages = messages.map((message) => {
              if (message.messageType === 'IMAGE') {
                return {
                  ...message,
                  imageUrl: `${config.exportChatImagePath}/${message.imageUrl}`,
                  imageThumbUrl: `${config.exportChatImagePath}/thumb/${message.imageUrl}`
                }
              }
              return message
            })

            socket.emit('getMessages', {
                messages: messages,
                meta: {
                  page,
                  pageSize,
                  totalElements,
                  totalPages
                }
            });
        });

        socket.on('joinRoom', async function (data) {
            console.log(socket.userId + ' Join room');
            console.log('Conversation id: ' + data.conversationId);
            socket.join(data.conversationId);
            var sequelize = socket.sequelize;

            //Read all messages
            await sequelize.query(`UPDATE "UserChatConversations" 
            SET "numberOfUnreadMessages" = 0
            WHERE "userId" = ?
            AND "conversationId" = ?`,
                { replacements: [socket.userId, data.conversationId], type: sequelize.QueryTypes.UPDATE }
            )
        });

        socket.on('getPhoneNumber', async function (data) {
            var sequelize = socket.sequelize;
            console.log('@@@@@@');
            console.log(data);
            var phoneNumber = await sequelize.query(`SELECT "phoneNumber" FROM "Users"
            WHERE id = (
            SELECT "userId" FROM "UserChatConversations" 
            WHERE "conversationId" = ?
            AND id <> (
            SELECT "id" FROM "UserChatConversations"
            WHERE "userId" = ? AND "conversationId" = ?
            )
            )`,
                { replacements: [data.conversationId, socket.userId, data.conversationId], type: sequelize.QueryTypes.SELECT }
            )
            if (phoneNumber && phoneNumber.length > 0) {
                socket.emit('userPhoneNumber', {
                    phoneNumber: phoneNumber[0].phoneNumber
                })
            } else {
                socket.emit('userPhoneNumber', {
                    phoneNumber: '0902207734'
                })
            }

        });

        socket.on('leaveRoom', function (data) {
            console.log(socket.userId + 'Leave room');
            socket.leave(data.conversationId);
        })

        socket.on('getConversations', async function () {
          const sequelize = socket.sequelize
            // var userChatConversations = await models.UserChatConversations.findAll({ where: { userId: socket.userId }, order: [['updatedAt', 'DESC']], raw: true });
            const userChatConversations = await sequelize.query(`select ucc.*, p.status from "UserChatConversations" ucc
              inner join "Project" p on ucc."projectId" = p.id where ucc."userId" = ? and p.status in (?)
              order by ucc."updatedAt" DESC
            `, { replacements: [ socket.userId, ['ONGOING', 'COMPLETE'] ], type: sequelize.QueryTypes.SELECT })
            
            socket.emit('getConversations', {
                messages: userChatConversations
            });
        });

        socket.on('clientSendMessage', async function (data) {
            const { conversationId, message, messageTime } = data;
            var sequelize = socket.sequelize;

            console.log(moment(messageTime).format('DD/MM/YYYY HH:mm:ss'));
            const json = {
                conversationId: conversationId,
                senderId: socket.userId,
                message: message,
                messageType: 'TEXT',
                messageTime: new Date(),
                imageUrl: '',
                videoUrl: '',
                soundUrl: ''
            }
            const newMessage = await models.Message.create(
                json
            );
            const newMessageJson = newMessage.get({ plain: true })

            io.to(conversationId).emit(
                'newMessage',
                newMessageJson
            );;

            //Send push notification
            //Check if receiver user online
            var isOnline = false;
            var countIsOnline = await sequelize.query(`
            select count(*) from "UserSockets"
            where "userId" = (select "userId" from "UserChatConversations"
            where "conversationId" = ? and "userId" <> ?)`,
                { replacements: [conversationId, socket.userId], type: sequelize.QueryTypes.SELECT }
            );
            var userSocket = await sequelize.query(`
              select "socketId" from "UserSockets"
              where "userId" = (select "userId" from "UserChatConversations"
              where "conversationId" = ? and "userId" <> ?)`,
                { replacements: [conversationId, socket.userId], type: sequelize.QueryTypes.SELECT }
            );
            console.log('user socket ===========> ', userSocket);
            if (countIsOnline[0].count > 0) {
                isOnline = true;
            }
            if (userSocket[0].socketId) {
              console.log('======== new notification ========')
              for (let i = 0; i < userSocket.length; i++) {
                io.to(userSocket[i].socketId).emit('newNotification', newMessageJson)
              }
              
            }
            if (true) {
                //get user id who receive
                var tempGetUserId = await sequelize.query(`SELECT "userId" FROM "UserChatConversations"
                WHERE "conversationId" = ? AND "userId" <> ?`,
                    { replacements: [conversationId, socket.userId], type: sequelize.QueryTypes.SELECT }
                );
                if (tempGetUserId && tempGetUserId.length > 0) {
                    console.log('send notification ========> ', tempGetUserId[0].userId)

                    const inputNoti = {
                        code: notificationConst.NEW_CHAT_MESSAGE,
                        userId: tempGetUserId[0].userId,
                        type: 'PUSH', // EMAIL, PUSH
                        title: 'You received a chat message',
                        content: message
                    }
                    // NotificationServices.sendNotification(inputNoti, false);
                }


            }

            //write latest messages
            await sequelize.query(`UPDATE "UserChatConversations" 
            SET "numberOfUnreadMessages" = "numberOfUnreadMessages" + 1,
            "latestMessage" = ?, "updatedAt" = ?
            WHERE "userId" IN (
                SELECT "userId" FROM "UserChatConversations"
                WHERE "conversationId" = ? AND "userId" <> ?
            )
            AND "conversationId" = ?`,
                { replacements: [message, new Date, conversationId, socket.userId, conversationId], type: sequelize.QueryTypes.UPDATE }
            );

            await sequelize.query(`UPDATE "UserChatConversations" 
            SET "latestMessage" = ?, "updatedAt" = ?
            WHERE "userId" = ?
            AND "conversationId" = ?`,
                { replacements: [message, new Date, socket.userId, conversationId], type: sequelize.QueryTypes.UPDATE }
            )
        });

        socket.on('messageFromCoach', function (data) {

        });
    });
}