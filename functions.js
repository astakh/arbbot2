const axios = require('axios'); 
const ccxt  = require ('ccxt');
require('dotenv').config();
const binance   = new ccxt.binance(         { apiKey: process.env.BINANCE_API_KEY,  secret: process.env.BINANCE_API_SECRET });
const wavesdex  = new ccxt.wavesexchange(   { apiKey: process.env.WAVESDEX_API_KEY, secret: process.env.WAVESDEX_API_SECRET });

function nowTime() { let spl = new Date().toISOString().split('T'); return spl[0] + " - " + spl[1]; }
async function sleep(time) { return new Promise((resolve, reject) => setTimeout(resolve, time)) }

async function sendAlert(text) {
    const TGBOT_KEY = process.env.TGBOT_KEY;
    const TGCHAT_ID = process.env.TGCHAT_ID;
    const URI       = `https://api.telegram.org/bot${TGBOT_KEY}/sendMessage`;
    try {
        const d = axios.post(URI, {
            chat_id:    TGCHAT_ID,
            parse_mode: 'html',
            text:       text
        }) 
        return d;
    }
    catch(err) {
        if (err.response.status == 429){
            console.log(err.response.data.description);
        }
        else {
            console.log(err);
        }
        return false;
    }

    
}

async function getMarketDirect(exch, volume) {
    let res = {sel: 0, buy: 0, avg: 0, time: new Date() };
    let apireq;
    if (exch == 'binance')  { 
        apireq = 'https://api.binance.com/api/v3/depth?limit=20&symbol=' + amountAsset + priceAsset; 
        try {
            const result = await axios.get(apireq);
            const bookW       = result.data;
            let vol     = 0;
            for (var i  = 0; i < 20; i++ ) {
                vol += parseFloat(bookW.bids[i][1]);
                if (vol > volume) { res.sel = parseFloat(bookW.bids[i][0]); break; }
            }
            vol = 0;
            for (var i = 0; i < 20; i++ ) {
                vol += parseFloat(bookW.asks[i][1]);
                if (vol > volume) { res.buy = parseFloat(bookW.asks[i][0]); break; }
            }
            res.avg = (res.sel+res.buy)/2;
            res.time        = new Date() - res.time;
            return {success: true, result: res};
        } catch(err) {  console.log(err); return {success: false, result: res}; } 
    }

    if (exch == 'wavesdex') { 
        apireq = 'https://matcher.waves.exchange/matcher/orderbook/' + amountAsset + "/" + priceAsset; 
        let amAssDig;
        let prAssDig; 
        try {
            const result = await axios.get(apireq);
            const bookW       = result.data;
            let vol     = 0;
            for (var i  = 0; i < 20; i++ ) {
                vol += parseFloat(bookW.bids[i].amount) / 10**8;
                if (vol > volume) { res.sel = parseFloat(bookW.bids[i].price) / 10**6; break; }
            }
            vol = 0;
            for (var i = 0; i < 20; i++ ) {
                vol += parseFloat(bookW.asks[i].amount) / 10**8;
                if (vol > volume) { res.buy = parseFloat(bookW.asks[i].price) / 10**6; break; }
            }
            res.avg     = (res.sel+res.buy)/2;
            res.time    = new Date() - res.time;
            return {success: true, result: res};
        } catch(err) {  console.log(err); return {success: false, result: res}; } 
    
    
    }
}
async function getMarket(exch, volume) {
    let t = Date.now();
    try{
        const book = await exch.fetchOrderBook('WAVES/USDN', 30)
        return {success: true, book: book, time: (Date.now()-t)}
    }
    catch(err) { console.log(err); return {success: false}; }
}
module.exports.nowTime          = nowTime;
module.exports.sleep            = sleep;
module.exports.sendAlert        = sendAlert;
module.exports.getMarket        = getMarket;