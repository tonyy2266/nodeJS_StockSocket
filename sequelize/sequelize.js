const Sequelize = require('sequelize');
const decamelize = require('decamelize');
const config = require('../config');

//Setup sequelize
const sequelize = new Sequelize(config.database, config.dbUser, config.dbPassword, {
  host: config.dbHost,
  dialect: config.dbDialect,
  port: config.dbPort,
  define: {
    underscored: true,
    freezeTableName: true,
    paranoid:false,
    timestamps:true,
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  // http://docs.sequelizejs.com/manual/tutorial/querying.html#operators
  operatorsAliases: false
});

// sequelize.addHook('beforeDefine', (attributes) => {
//   Object.keys(attributes).forEach((key) => {
//     if (typeof attributes[key] !== 'function') {
//       attributes[key].field = decamelize(key);
//     }
//   });
// });

module.exports = sequelize;