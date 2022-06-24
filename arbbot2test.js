const ccxt      = require ('ccxt');
const axios     = require ('axios');
const db        = require('./db/dbarbbot2')
const wm        = require('./db/wavesmatcher')
const WebSocket = require('ws');
const func      = require('./functions')
require('dotenv').config();
let bws         = new WebSocket('wss://stream.binance.com:9443/ws/wavesusdt@bookTicker');
bws.onmessage   = (event) => {
    let sockObj = JSON.parse(event.data);
    market.left.coin.sell = parseFloat(sockObj.b);
    market.left.coin.buy = parseFloat(sockObj.a);
    market.left.coin.avg = (market.left.coin.buy+market.left.coin.sell)/2;
}

const ccxtObject = {
    binance:        new ccxt.binance(         { apiKey: process.env.BINANCE_API_KEY,  secret: process.env.BINANCE_API_SECRET }),
    wavesexchange:  new ccxt.wavesexchange(   { apiKey: process.env.WAVESDEX_API_KEY, secret: process.env.WAVESDEX_API_SECRET })
}


async function getBalances() {
    const t = Date.now()
    if (balance.nextTime < Date.now() ) {
        let bin = ccxtObject.binance.fetchBalance()
        let wav = ccxtObject.wavesexchange.fetchBalance();
        Promise.all([bin, wav])
        .then(bal => {
            if (bal[0].WAVES.free)   { balance.left.coin    = bal[0].WAVES.free; } 
            if (bal[0].USDT.free)    { balance.left.base1   = bal[0].USDT.free; }  
            if (bal[1].WAVES.free)   { balance.right.coin   = bal[1].WAVES.free; } 
            if (bal[1].USDT.free)    { balance.right.base1  = bal[1].USDT.free; }  
            if (bal[1].USDN.free)    { balance.right.base2  = bal[1].USDN.free; }  
            balance.ok = true
        }, err => {console.log(err); balance     = {ok: false, left: {coin: 0, base1: 0}, right: {coin: 0, base1: 0, base2: 0}, nextTime: 0} })
        console.log(`Balances: left: ${balance.left.coin} ${balance.left.base1} || right: ${balance.right.coin} ${balance.right.base2} time: ${Date.now() - t}`)
        balance.nextTime = Date.now() + 60*1000;
    }
    //return true    
}
async function placeOrder(exch, pair, orderType, orderDirection, amount, price) {
    let res = {};
    if (exch == ccxtObject.wavesexchange) {
        console.log('try to place waves order');
        let order;
        if (pair == 'WAVES/USDN')   { order = await wm.placeWAVESUSDNOrder(amount, price, orderDirection); }
        if (pair == 'USDT/USDN')    { order = await wm.placeUSDTUSDNOrder(amount, price, orderDirection); }

        if (order.success) { 
            res.success = true 
            res.orderId      = order.orderId;
        } else { res.success = false; res.error = order.error }
    }
    else {
        try {
            const order = await exch.createOrder(pair, orderType, orderDirection, amount, price) 
            res.success = true 
            res.orderId = order.orderId
        }
        catch(err) { res.success=false;  res.error=err; }
    }
    return res;
}
async function getOrder(exch, id, pair) {
    let res = {};
    try {
        const order = await exch.fetchOrder(id, pair);
        res.success = true;
        res.order   = order;
        res.orderId = order.orderId;
        res.price   = order.price;
        res.average = order.average;
        res.status  = order.status;
    }
    catch(err) { res.success=false;  res.error=err; }
    return res;
}
async function getMarkets() {
    if (rateTime < Date.now() ) {
        const rates = await func.getMarketDirect('wavesdex', '34N9YcEETLWn93qYQ64EsP1x89tSruJU44RrEMSXXEPJ', 'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p', 200);
        if (rates.success) {
            console.log(`USDT/USDN : ${(rates.result.avg/100).toFixed(4)} `); 
            market.right.base.sell = rates.result.sell/100;
            market.right.base.buy = rates.result.buy/100;
            market.right.base.avg = rates.result.avg/100;
            rateTime = Date.now() + 1000;
        }
    }
    rates = await func.getMarketDirect('wavesdex', 'WAVES', 'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p', 200);
    if (rates.success) { 
        market.right.coin.sell = rates.result.sell;
        market.right.coin.buy = rates.result.buy;
        market.right.coin.avg = rates.result.avg; 
    }
}
async function getScopes() {
    //console.log(market.left.coin, market.left.base, market.right.coin, market.right.base)
    scope = {sell: 0, buy: 0}
    if (market.left.coin.sell>0 && market.left.coin.buy>0 && market.right.coin.sell>0 && market.right.coin.buy>0 && market.right.base.sell>0 && market.right.base.buy>0) {
        scope.buy  = (market.right.coin.sell/market.right.base.buy  - market.left.coin.buy) / market.left.coin.buy * 100;
        scope.sell  = (market.left.coin.sell - market.right.coin.buy/market.right.base.sell) / market.left.coin.sell * 100;
        console.log(`Scope sell: ${scope.sell.toFixed(2)} || buy ${scope.buy.toFixed(2)}`)
        return true
    } else {
        console.log('Scope: market', market.left.coin.sell, market.left.coin.buy, market.right.coin.sell, market.right.coin.buy, market.right.base.sell, market.right.base.buy )
        return false
    }
}
function setDelay(bot, scope, direction) {
    let delay = 0;
    if (direction == 'sell') if (scope.sell < 0) { delay = 2000; } else if (scope.sell < bot.disbalLeft/2) {delay = 1000; } 
    if (direction == 'buy')  if (scope.buy < 0)  { delay = 2000; } else if (scope.buy < bot.disbalRigh/2)  {delay = 1000; }
    return delay;
}
let balance     = {left: {coin: 0, base1: 0}, right: {coin: 0, base1: 0, base2: 0}, nextTime: 0};
let scope       = {};
let rateTime    = 0;  
let market      = { left: {coin: {sell: 0, buy: 0, avg: 0}, base: {sell: 1, buy: 1, avg: 1}}, right:{coin: {sell: 0, buy: 0, avg: 0}, base: {sell: 0, buy: 0, avg: 0}} }
//exchanges['wavesdex']   = wavesdex;
//exchanges['binance']    = binance;

async function handleBots(bot) { 
    console.log(`${bot.name}: waiting ${bot.waiting} stage ${bot.stage}`)
    let tradeAmount = 0
    scope[bot.waiting] = 1
    if (bot.stage == 0) {
        if (scope[bot.waiting] > bot.range[bot.waiting]) {
            console.log(bot.amount, balance.left.coin, balance.right.base2, market.right.coin.buy )
            if (bot.waiting == 'sell') tradeAmount = parseInt(Math.min( bot.amount, balance.left.coin, balance.right.base2 / market.right.coin.buy / 1.03 ))-1
            else tradeAmount = parseInt(Math.min( bot.amount, balance.right.coin, balance.left.base1 / market.left.coin.buy / 1.03 ))-1
            if (tradeAmount > 1) {
                bot.stage = 1
                console.log(`${bot.name}: Starting ${bot.waiting}-trade: amount ${tradeAmount}`)
            }
        } 
    }
    
    if (bot.stage == 1) {
        if (tradeAmount > 0) {
            let reverse = ''
            //bot.orderLeft  = placeOrder(bot.exchanges.ccxt.left,  bot.orderMask[bot.waiting].left.pair,  'limit', bot.orderMask[bot.waiting].left.direction,  tradeAmount, market.left.coin[bot.waiting])
            console.log(bot.orderMask[bot.waiting].left.pair,  'limit', bot.orderMask[bot.waiting].left.direction,  tradeAmount, market.left.coin[bot.waiting])
            if (bot.waiting == 'sell') {reverse = 'buy'} else { reverse = 'sell'}
            //bot.orderRight = placeOrder(bot.exchanges.ccxt.right, bot.orderMask[bot.waiting].right.pair, 'limit', bot.orderMask[bot.waiting].right.direction, tradeAmount, market.right.coin[reverse])
            console.log(bot.orderMask[bot.waiting].right.pair, 'limit', bot.orderMask[bot.waiting].right.direction, tradeAmount, market.right.coin[reverse])

            bot.stage   = await db.setStage (bot.botId, 2)
            bot.dealId  = await db.addDeal  (bot.botId)
            await db.addLog(bot, `${bot.name}: deal started`)

        } else { bot.stage = 0 }

    }
    if (bot.stage == 2) { // waiting for place orders
        //const orderLeft = await bot.orderLeft
        //const orderRight= await bot.orderRight
        let orderLeft = {success: true, orderId: 'leftorder'}
        let orderRight = {success: true, orderId: 'rightorder'}
        if (orderLeft.success) {
            bot.orders  = await db.addOrder(bot, orderLeft.orderId,  'left')
        } else { console.log(orderLeft.error)}
        
        if (orderRight.success) {
            bot.orders  = await db.addOrder(bot, orderRight.orderId,  'right')
        } else { console.log(orderRight.error)}
        
        if (orderLeft.success && orderRight.success) {
            bot.stage   = await db.setStage(bot, 3)                     
        }
    }
    
    if (bot.stage == 3) {   // waiting for orders closed
        if (!bot.orders[bot.waiting].left.closed){
            //const orderLeft = await getOrder(bot.exchange.ccxt.left, bot.orders[bot.waiting].left.orderId, bot.orderMask[bot.waiting].left.pair)
            console.log('getOrder: ', bot.orders[bot.waiting].left.orderId, bot.orderMask[bot.waiting].left.pair)
            let orderLeft = {success: true, status: 'closed', average: 12, orderId: 'leftorder'}
            if (orderLeft.success) {
                if (orderLeft.status == 'closed') {     // save
                    bot.orders = await db.updateOrder(bot, orderLeft, 'left')
                }
            }
        }
        if (!bot.orders[bot.waiting].right.closed){
            //const orderRight = await getOrder(bot.exchange.ccxt.right, bot.orders[bot.waiting].right.orderId, bot.orderMask[bot.waiting].right.pair)
            let orderRight = {success: true, status: 'closed', average: 10, orderId: 'rightorder'}
            if (orderRight.success) {
                if (orderRight.status == 'closed') {     // save
                    bot.orders = await db.updateOrder(bot, orderRight, 'right')
                }
            }
        }

        if (bot.orders[bot.waiting].right.closed && bot.orders[bot.waiting].left.closed) { // restart or revert
            if (bot.waiting == 'buy') {
                bot = await db.restartBot(bot)
                await db.addLog(bot, `${bot.name}: restarted`)
                bot.restarted = true
                bot.exchange.ccxt.left  = ccxtObject[bot.exchange.left]
                bot.exchange.ccxt.right = ccxtObject[bot.exchange.right]
            }
            else {
                bot.waiting = 'buy'
                bot.stage   = await db.setStage(bot.botId, 0)
                await db.addLog(bot, `${bot.name}: reverted`)
            }
        }

    }

    
    return bot
    
}
async function botLoop() { 
    let bots = await db.getBots() 
    for (var i=0; i<bots.length; i++) {
        bots[i].exchanges.ccxt.left  = ccxtObject[bots[i].exchanges.left]
        bots[i].exchanges.ccxt.right = ccxtObject[bots[i].exchanges.right]
    }
    console.log(`Having ${bots.length} bots..`)
    if (bots) {
        let gogo = true
        while(gogo) {
            // get situation
            await getMarkets()
            const scopeOk = await getScopes()
            await getBalances()

            // handle bots
            if (scopeOk && balance.ok) {
                console.log(`Balances: left: ${balance.left.coin.toFixed(0)}W ${balance.left.base1.toFixed(0)}D || right: ${balance.right.coin.toFixed(0)}W ${balance.right.base2.toFixed(0)}D `)
                console.log(`Market  : left: sell ${market.left.coin.sell}|| buy ${market.left.coin.buy}|||right: sell ${market.right.coin.sell}|| buy ${market.right.coin.buy}`)

                for (var i=0; i<bots.length; i++) {
                    bots[i] = await handleBots(bots[i])
                    if (bots[i].restarted) gogo = false
                }
            }
        }
    }
    
 
}

botLoop();

