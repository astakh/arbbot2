const { exchanges } = require('ccxt');
const mongodb       = require('mongodb');
const mongoose      = require('mongoose'); 
const func          = require('../functions');
require('dotenv').config();
const {Mask}        = require('../models/Bots')
const {Bot}         = require('../models/Bots')
const {Deal}          = require('../models/Deals');
const { Log }       = require('./Logs');

const db            = process.env.DB_ARB2_PATH; 
mongoose
.connect(db)
.then((res) => console.log('Connected to DB'))
.catch((err) => console.log(err));

async function getBots() {
    try {
        const bots = Bot.find({active: true})
        return bots
    } catch(err) { console.log(err); return false; }
}

async function addMask() {
    let params      = {}
    params.active   = false
    params.name     = 'Anton2_43_30'
    params.stage    = 0
    params.amount   = 30
    params.waiting  = 'sell'
    params.range    = {sell: 0.43, buy: 0.30}
    params.orderMask= {
        sell: {
            left:   {direction: 'sell', pair: 'WAVES/USDT'},
            right:  {direction: 'buy',  pair: 'WAVES/USDN'}
        },
        buy: {
            left:   {direction: 'buy',  pair: 'WAVES/USDT'},
            right:  {direction: 'sell', pair: 'WAVES/USDN'}
        },
        rebal: {
            right:  {direction: 'sell', pair: 'USDT/USDN'}
        }
    }
    params.orders   = {
        sell:   {left: {orderId: '', placed: false, closed: false, average: 0}, right: {orderId: '', placed: false, closed: false, average: 0}},
        buy:    {left: {orderId: '', placed: false, closed: false, average: 0}, right: {orderId: '', placed: false, closed: false, average: 0}}
    }
    params.exchanges= {left: 'binance', right: 'wavesexchange', ccxt: {left: '', right: ''}}
    params.coins    = {
        left: {
            coin:   'WAVES',
            base:   'USDT',
            pair:   'WAVES/USDT'
        }, 
        right: {
            coin:   'WAVES',
            base:   'USDN',
            pair:   'WAVES/USDN'
        } 
    }
    params.dealId   = ''
    params.profit   = 0

    let mask    = new Mask(params);
    let bot     = new Bot(params);
    bot.maskId  = mask._id; 
    mask.maskId = mask._id; 
    bot.botId  = bot._id; 
    mask.botId = bot._id; 

    await bot.save(); 
    await mask.save();
    console.log(bot._id, 'bot created');
    console.log(mask._id, 'mask created');

    
}
async function addOrder(bot, orderId, side) {
    try {
        const b = await Bot.findById(bot.botId)
        let newOrders = b.orders
        newOrders[bot.waiting][side] = {orderId: orderId, placed: true, closed: false, average: 0}
        await Bot.updateOne({_id: bot.botId}, {orders: newOrders})
        await addLog(bot, `Order ${side} added`)
        return newOrders
    }
    catch(err) { console.log(err); return false}
}
async function setStage(bot, stage) {
    await Bot.updateOne({_id: bot.botId}, {stage: stage})
    await addLog(bot, `go to stage ${stage}`)
    return stage
}

async function updateOrder(bot, order, side) {
    try {
        const b = await Bot.findById(bot.botId)
        let newOrders = b.orders
        newOrders[bot.waiting][side] = {orderId: order.orderId, placed: true, closed: true, average: order.average}
        //func.sendAlert(`profit = ${bot.profit.toFixed(2)} + ${order.average.toFixed(2)} * ${order.amount.toFixed(2)} * ${order.inOut}`)
        bot.profit += order.average * order.amount * order.inOut
        bot.profit -= order.average * order.amount * (0.0005 + 0.00075) / 2
        await Bot.updateOne({_id: bot.botId}, {orders: newOrders, profit: bot.profit})
        await addLog(bot, `Order ${side} updated`)
        return newOrders
    }
    catch(err) { console.log(err); return false}
} 
async function addDeal(bot) {
    const deal = new Deal({botId: bot.botId})
    await deal.save()
    await Bot.updateOne({_id: bot.botId}, {dealId: deal._id})
    await addLog(bot, `${bot.name}: deal started`)
    func.sendAlert(`${bot.name}: deal started`)
    return deal._id
}
async function restartBot(bot) {
    const params = {
        profit: bot.profit,
        orders: bot.orders,
        maskId: bot.maskId
    }
    await Deal.updateOne({_id: bot.dealId}, params)
    func.sendAlert(`${bot.name} restarted: profit ${bot.profit.toFixed(1)}`)
    const mask  = await Mask.findById(bot.maskId, {_id: 0}) 
    mask.active = true
    await Bot.updateOne({_id: bot.botId}, mask)
    await addLog(bot, 'Restarted')
    return mask

}
async function revertBot(bot) {

    await Deal.updateOne({_id: bot.dealId}, {orders: bot.orders})
    await Bot.updateOne({_id: bot.botId}, {waiting: 'buy'})
    await addLog(bot, 'Reverted')
    func.sendAlert(`${bot.name} reverted: profit ${bot.profit.toFixed(1)}`)
    return 'buy'

}

async function addLog(bot, text) {
    const log = new Log({botId: bot.botId, maskId: bot.maskId, dealId: bot.dealId, text: text})
    await log.save()
    console.log(text)
}

module.exports.addLog       = addLog;
module.exports.addDeal      = addDeal;
module.exports.restartBot   = restartBot;
module.exports.revertBot    = revertBot;
module.exports.setStage     = setStage;
module.exports.addMask      = addMask;
module.exports.getBots      = getBots
module.exports.addOrder     = addOrder
module.exports.updateOrder  = updateOrder