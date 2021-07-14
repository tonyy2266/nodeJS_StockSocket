const format = require('string-format')

const findMessage = async (req, input) => {
  let msg = 'System has error'
  if (input && input.lang && input.code) {
    try {
      const sequelize = req.app.locals.sequelize
      const lang = input.lang
      const code = input.code

      const sql = `SELECT "value" FROM "SysMessages" where "code" = '${code}'`
      console.log(sql);
      const result = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT, replacements: { code } })
      console.log(result);
      if (result && result.length > 0) {
        const value = result[0].value
        if (value) {
          if (!lang || lang === 'en') {
            msg = value.en
          } else {
            msg = value.vi
          }
        }
        if (input.params && input.params.length > 0) {
          msg = await format(msg, input.params)
        }
      }
    } catch (error) {
      console.log(error)
    }
  }
  return msg
}

module.exports = {
  findMessage,
}