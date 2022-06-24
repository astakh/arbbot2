//const fetch         = require('node-fetch');
const wd            = require('@waves/waves-transactions')
require('dotenv').config();

wallet              = process.env.WAVES_WALLET;  
seed                = process.env.WAVES_SEED;
matcherUrl          = 'https://matcher.waves.exchange';
matcherPublicKey    = '9cpfKN9suPNvfeUNphzxXMjcnn974eme8ZhWUjaktzU5';
amountAssetId       = 'WAVES';
priceAssetId        = 'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p'; // USDN на Mainnet
matcherFeeAssetId   = "Atqv59EYzjFGuitKVnMRk6H8FukjoV3ktPorbEys25on"; // WX

const usdt = '34N9YcEETLWn93qYQ64EsP1x89tSruJU44RrEMSXXEPJ';
const usdn = 'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p'; 

async function tryPlaceOrder(orderParams) {
    let signedOrder = wd.order(orderParams, seed);
    let res = {}; 
    try {
        const order = await wd.submitOrder(signedOrder, matcherUrl)  
        //console.log('placed order ID: '+ order.message.id)
        res.success = true
        res.orderId = order.message.id 
    }
    catch (e) {  
        res.success = false 
        res.errorType = `ERROR:${e.error} ${e.message}`;
    } 
    return res 
}
async function getFee(orderParams) { 
    let signedOrder       = wd.order(orderParams, seed) 
    try {
        await wd.submitOrder(signedOrder, matcherUrl);
        //console.log('placed order ID: '+ signedOrder.orderId);
    }
    catch (e) { 
        if (e.error == 9441542) {  // fee corection required
            let st = e.message.indexOf(" ") + 1; 
            let feee = parseInt(parseFloat(e.message.substring(st, e.message.indexOf(" ", st)))*10**8) + 10 
            orderParams.matcherFee = feee;
            orderParams.feeCalculated = true; 
        }
        else {
            console.log(e.message);
            orderParams.error = e.message;
        }

    }
    return orderParams; 

}
/*
async function orderWavesStatus(orderCurr) {
    let res = {};
    if (orderCurr != ''){
        try {
            let response    = await fetch(matcherUrl + '/matcher/orderbook/' + amountAssetId + '/' + priceAssetId + '/' + orderCurr);
            let json        = await response.json();
            res.exists      = true;
            //console.log('Order status json: ' + json.status);
            res.status      = json.status;
            res.orderId          = orderCurr;
        } catch (e) {
            console.log('orderStatus ERROR: ' + e.message);
            res.orderId          = orderCurr.orderId;
            res.status      = 'error';
        }
    }
    else {

    }

    //console.log("orderStatus: ", orderCurr.orderId, res.status);
    return res;
}*/
async function placeWAVESUSDNOrder(amount, price, orderType) {
    var orderParams = {
        // Фактическое количество amount-ассета нужно умножить на 10^amountAssetDecimals
        amount:             parseInt(amount * 10**8), // 1 WAVES
        // Цену, выраженную в price-ассете, нужно умножить на 10^(8 + priceAssetDecimals – amountAssetDecimals)
        version: 3,
        price:              parseInt(price * 10**6), 
        amountAsset:        'WAVES',
        priceAsset:         'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p',
        matcherPublicKey:   matcherPublicKey,
        orderType:          orderType,
        matcherFee:         1,
        matcherFeeAssetId:  matcherFeeAssetId, // WX
        feeCalculated:      false,
    }
    let res = {}
    orderParams = await getFee(orderParams)
    if (orderParams.feeCalculated) {
        let ord = await tryPlaceOrder(orderParams);
        if (ord.success) { 
            res.orderId = ord.orderId; 
            res.success = true;
        }
        else { 
            res.success = false
            res.error   = ord.errorType;
        }
    }
    else { res.success = false; res.error = 'fee not calculated'; console.log('fee not calculated' , orderParams.error); }
    return res;
}
 
async function placeUSDTUSDNOrder(amount, price, orderType) {
    var orderParams = {
        // Фактическое количество amount-ассета нужно умножить на 10^amountAssetDecimals
        amount:             parseInt(amount * 10**6), // 1 WAVES
        // Цену, выраженную в price-ассете, нужно умножить на 10^(8 + priceAssetDecimals – amountAssetDecimals)
        version: 3,
        price:              parseInt(price * 10**8), 
        amountAsset:        '34N9YcEETLWn93qYQ64EsP1x89tSruJU44RrEMSXXEPJ',
        priceAsset:         'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p',
        matcherPublicKey:   matcherPublicKey,
        orderType:          orderType,
        matcherFee:         1,
        matcherFeeAssetId:  matcherFeeAssetId, // WX
        feeCalculated:      false,
    }
    let res = {};
    orderParams = await getFee(orderParams);
    if (orderParams.feeCalculated) {
        let ord = await tryPlaceOrder(orderParams);
        if (ord.success) { 
            res.orderId      = ord.orderId; 
            res.success = true;
            res.order   = ord;
        }
        else { 
            res.success = false
            res.error   = ord.errorType 
        }
    }
    else { res.success = false; res.error = 'fee not calculated'; console.log('fee not calculated' , orderParams.error); }
    return res;
}

module.exports.placeWAVESUSDNOrder = placeWAVESUSDNOrder;
//module.exports.orderWavesStatus= orderWavesStatus;
module.exports.placeUSDTUSDNOrder = placeUSDTUSDNOrder;