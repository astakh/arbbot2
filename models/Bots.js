const { Schema, model } = require('mongoose');
const params = {
    name:       { type: String, },
    active:     { type: Boolean,},
    stage:      { type: Number, },
    amount:     { type: Number, },
    profit:     { type: Number, },
    waiting:    { type: String, },
    range:      { type: Object, },
    orderMask:  { type: Object, },
    orders:     { type: Object, },
    coins:      { type: Object, },
    exchanges:  { type: Object, },
    site:       { type: String, },
    maskId:     { type: String, },
    botId:      { type: String, },
    dealId:     { type: String, }
} 

const botSchema = new Schema (params, {timestamps: true}) 
const maskSchema = new Schema (params, {timestamps: true}) 

module.exports.Bot = model('Bot', botSchema)
module.exports.Mask = model('Mask', maskSchema)