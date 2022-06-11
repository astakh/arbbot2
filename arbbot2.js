const ccxt  = require ('ccxt');
const axios = require ('axios');
const db    = require('./db/dbarbbot2');
const WebSocket = require('ws');
const func  = require('./functions2');
require('dotenv').config();
let bws = new WebSocket('wss://stream.binance.com:9443/ws/wavesusdt@bookTicker');
bws.onmessage = (event) => {
    let sockObj = JSON.parse(event.data);
    market.left.coin.sel = parseFloat(sockObj.b);
    market.left.coin.buy = parseFloat(sockObj.a);
    market.left.coin.avg = (market.left.coin.buy+market.left.coin.sel)/2;
}

const binance   = new ccxt.binance(         { apiKey: process.env.BINANCE_API_KEY,  secret: process.env.BINANCE_API_SECRET });
const wavesdex  = new ccxt.wavesexchange(   { apiKey: process.env.WAVESDEX_API_KEY, secret: process.env.WAVESDEX_API_SECRET });


async function getBalances() {
    if (balance.nextTime < Date.now() ) 
    try {
        let b = await binance.fetchBalance();
        if (b.WAVES.free)   { balance.left.coin = b.WAVES.free; } 
        if (b.USDT.free)    { balance.left.base1 = b.USDT.free; }  

        b = await wavesdex.fetchBalance();
        if (b.WAVES.free)   { balance.right.coin = b.WAVES.free; } 
        if (b.USDT.free)    { balance.right.base1 = b.USDT.free; }  
        if (b.USDN.free)    { balance.right.base2 = b.USDN.free; }  
        console.log(`Balances: left: ${balance.left.coin} ${balance.left.base1} || right: ${balance.right.coin} ${balance.right.base2}`)
        balance.nextTime = Date.now() + 2000;
        return true;
    }
    catch(err) { console.log('getBalances: error', err); return false; }
    
}
async function placeOrder(exch, pair, orderType, orderDirection, amount, price) {
    let res = {};
    if (exch == wavesdex) {
        console.log('try to place waves order');
        let order;
        if (pair == 'WAVES/USDN')   { order = await wd.placeWAVESUSDNOrder(amount, price, orderDirection); }
        if (pair == 'USDT/USDN')    { order = await wd.placeUSDTUSDNOrder(amount, price, orderDirection); }

        if (order.success) {
        
            order       = await getOrder(exch, order.id, pair);
            res.success = true;
            res.order   = order;
            res.price   = order.price;
            res.id      = order.id;
        } else { res.success = false; }
    }
    else {
        try {
            let order   = await exch.createOrder(pair, orderType, orderDirection, amount, price);
            order       = await getOrder(exch, order.id, pair);
            res.success = true;
            res.order   = order;
            res.price   = order.price;
            res.id      = order.id;
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
        res.id      = order.id;
        res.price   = order.price;
        res.average = order.average;
        res.status  = order.status;
    }
    catch(err) { res.success=false;  res.error=err; }
    return res;
}
async function getMarkets() {
    if (rateTime < Date.now() ) {
        let rates = await func.getMarketDirect('wavesdex', '34N9YcEETLWn93qYQ64EsP1x89tSruJU44RrEMSXXEPJ', 'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p', 200);
        if (rates.success) {
            console.log(`USDT/USDN : ${(rates.result.avg/100).toFixed(4)} `); 
            market.right.base.sel = rates.result.sel/100;
            market.right.base.buy = rates.result.buy/100;
            market.right.base.avg = rates.result.avg/100;
            rateTime = Date.now() + 1000;
        }
    }
    rates = await func.getMarketDirect('wavesdex', 'WAVES', 'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p', 200);
    if (rates.success) { 
        market.right.coin.sel = rates.result.sel;
        market.right.coin.buy = rates.result.buy;
        market.right.coin.avg = rates.result.avg; 
    }
}
async function getScopes() {
    console.log(market.left.coin, market.left.base, market.right.coin, market.right.base)
    scope = {sel: 0, but: 0}
    if (market.left.coin.sel>0 && market.left.coin.buy>0 && market.right.coin.sel>0 && market.right.coin.buy>0 && market.right.base.sel>0 && market.right.base.buy>0) {
        scope.buy = (market.right.coin.sel/market.right.base.buy  - market.left.coin.buy) / market.left.coin.buy * 100;
        scope.sel = (market.left.coin.sel - market.right.coin.buy/market.right.base.sel) / market.left.coin.sel * 100;
        console.log(`Scope sell: ${scope.sel.toFixed(2)} || buy ${scope.buy.toFixed(2)}`);
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
let exchanges   = []; 
let order;
let bot         = {};
let bots        = [];
let goNext      = false;
let rateTime    = 0; 
let scopeTime   = 0;
let market      = { left: {coin: {sel: 0, buy: 0, avg: 0}, base: {sel: 1, buy: 1, avg: 1}}, right:{coin: {sel: 0, buy: 0, avg: 0}, base: {sel: 0, buy: 0, avg: 0}} }
exchanges['wavesdex']   = wavesdex;
exchanges['binance']    = binance;
async function procVersion2(bot) {
    if (bot.stage == 0) { // looking possibilities to sell
        let next = false;
        if (scope.sel > bot.disbal.deal.sel) { 
            bot.move.sel.left.base  = bot.amount.base;
            bot.move.sel.left.coin  = parseInt(bot.amount.base / market.left.coin.sel) - 1;
            bot.move.sel.right.coin = bot.move.sel.left.coin;
            bot.move.sel.right.base = bot.move.sel.right.coin * market.right.coin.buy;
            next = true; 
        } 
        if (next) {         // check-correct amounts
            next = false;
            if (balance.left.coin >= bot.move.sel.left.coin){
                if (balance.right.base2 >= bot.move.sel.right.base) {next = true;}
                else if (balance.right.base2 > bot.amount.base*0.8) {
                    bot.move.sel.right.coin = parseInt(balance.right.base2 / market.right.coin.buy);
                    bot.move.sel.right.base = bot.move.sel.right.coin * market.right.coin.buy;
                    bot.move.sel.left.coin  = bot.move.sel.right.coin;
                    bot.move.sel.left.base  = bot.move.sel.right.coin * market.left.coin.sel;
                    next = true;
                }
            }
            else {
                if (balance.left.coin > parseInt(bot.amount.base / market.left.coin.sel*0.8)) {
                    bot.move.sel.left.coin  = parseInt(balance.left.coin);
                    bot.move.sel.left.base  = bot.move.sel.left.coin * market.left.coin.sel;
                    bot.move.sel.right.coin = bot.move.sel.left.coin;
                    bot.move.sel.right.base = bot.move.sel.right.coin * market.right.coin.buy;
                    next = true;
                }
            } 
        }
        if (next) {         // start deal
            bot.dealId = await addDeal(bot);
            console.log(`${bot.name}: deal started`);
        } else console.log(`${bot.name}: balance too low`);
    }
}
async function botLoop() { 

    bot = await db.getProc('62a35e5239ce01de09ee394f'); // get proc data ================= 
    if (bot) try {
        bot.exchLeft    = exchanges[bot.exchangeLeft];
        bot.exchRigh    = exchanges[bot.exchangeRigh];
        bot.nextTime    = Date.now();
        bots.push(bot);
        goNext = true;
        console.log(`Having ${bots.length} bots..`);
    } catch (err) { goNext = false; console.log(err); }


    while(goNext) {
        await getMarkets();
        await getBalances();
        await getScopes();
        //console.log(market);

        for (var i = 0; i < bots.length; i++ ) {
            if (bots[i].procType == 'version2') bot[i] = procVersion2(bot[i]);

        }
    }
}

botLoop();

