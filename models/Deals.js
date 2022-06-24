const { Schema, model } = require('mongoose');
const params = {
    profit:     { type: Number, },
    orders:     { type: Object, },
    maskId:     { type: String, },
    botId:      { type: String, },
    dealId:     { type: String, }
} 

const dealSchema = new Schema (params, {timestamps: true}) 

module.exports.Deal = model('Deal', dealSchema)