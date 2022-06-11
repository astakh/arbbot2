const ccxt  = require ('ccxt');
const axios = require ('axios');
const db    = require('./db/dbarbbot2');
const WebSocket = require('ws');
const func  = require('./functions');
const binance   = new ccxt.binance(         { apiKey: process.env.BINANCE_API_KEY,  secret: process.env.BINANCE_API_SECRET });
const wavesdex  = new ccxt.wavesexchange(   { apiKey: process.env.WAVESDEX_API_KEY, secret: process.env.WAVESDEX_API_SECRET });

async function main() {
    const book = await func.getMarket(wavesdex, 200);
    console.log(book)
}

main();