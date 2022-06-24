const { Schema, model } = require('mongoose');
const params = {
    maskId:     { type: String, },
    botId:      { type: String, },
    dealId:     { type: String, },
    text:       { type: String, }
} 

const logSchema = new Schema (params, {timestamps: true}) 

module.exports.Log = model('Log', logSchema)