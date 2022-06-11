const mongodb   = require('mongodb');
const mongoose  = require('mongoose'); 
const func      = require('../functions');
require('dotenv').config();


const db        = process.env.DBPATH; 
mongoose
    .connect(db)
    .then((res) => console.log('Connected to DB'))
    .catch((err) => console.log(err));

    const Schema = mongoose.Schema; 

    const maskSchema = new Schema ({
        enabled:            { type: Boolean,},
        stage:              { type: Number, },
        profit:             { type: Number, },
        exchangeLeft:       { type: String, },
        exchangeRigh:       { type: String, },
        strategy:           { type: String, },
        procType:           { type: String, },
        pairLeft:           { type: String, },
        pairRigh:           { type: String, },
        pairLeftA:          { type: String, },
        pairLeftC:          { type: String, },
        pairRighA:          { type: String, },
        pairRighC:          { type: String, },
        balLeftA:           { type: Number, },
        balLeftC:           { type: Number, },
        balRighA:           { type: Number, },
        balRighC:           { type: Number, },
        rateLeft:           { type: Number, },
        rateRigh:           { type: Number, },
        disbalLeft:         { type: Number, },
        disbalRigh:         { type: Number, },
        disbalRebal:        { type: Number, },
        amount:             { type: Number, },
        amountC:            { type: Number, },
        stage:              { type: Number, },
        orderUsdtUsdn:      { type: String, },
        orderUsdtUsdnClosed:{ type: Boolean,},
        orderUsdtUsdnPrice: { type: Number, },
        orderLeftBuy:       { type: String, },
        orderRighBuy:       { type: String, },
        orderLeftSell:      { type: String, },
        orderRighSell:      { type: String, },
        orderLeftBuyPrice:  { type: Number, },
        orderRighBuyPrice:  { type: Number, },
        orderLeftSellPrice: { type: Number, },
        orderRighSellPrice: { type: Number, },
        orderLeftBuyClosed: { type: Boolean,},
        orderRighBuyClosed: { type: Boolean,},
        orderLeftSellClosed:{ type: Boolean,},
        orderRighSellClosed:{ type: Boolean,},
        botId:              { type: String, },
        procId:             { type: String, },
        dealId:             { type: String, },
        lastAction:         { type: String, },
        }, {timestamps: true});
        const Mask = mongoose.model('Mask', maskSchema); 
        const Proc = mongoose.model('Proc', maskSchema); 
    
    const dealSchema = new Schema ({
        procId:             { type: String, },
        profit:             { type: Number, },
        amount:             { type: Number, },
        orderLeftBuy:       { type: String, },
        orderRighBuy:       { type: String, },
        orderLeftSell:      { type: String, },
        orderRighSell:      { type: String, },
        startTime:          { type: String, },
        endedTime:          { type: String, },
        orderLeftBuyPrice:  { type: Number, },
        orderRighBuyPrice:  { type: Number, },
        orderLeftSellPrice: { type: Number, },
        orderRighSellPrice: { type: Number, },
        }, {timestamps: true});
        const Deal = mongoose.model('Deal', dealSchema); 
    
    const logSchema = new Schema ({
    text:   { type: String, } }, {timestamps: true});
    const Log = mongoose.model('Log', logSchema); 
    const botprocSchema = new Schema ({
        botId:      { type: String, }, 
        procId:     { type: String, },
        active:     { type: Boolean,}, 
    
    }, {timestamps: true});
        const Botproc = mongoose.model('Botproc', botprocSchema); 
    
    const scopeSchema = new Schema ({
        buy:    { type: Number, }, 
        sell:   { type: Number, } 
    }, {timestamps: true});
    const Scope = mongoose.model('Scope', scopeSchema); 

    const testSchema = new Schema ({
        text:       { type: String, },
        currency:   { type: Object, },
        curs:       { type: Array, }
    }, {timestamps: true});
    const Test = mongoose.model('Test', testSchema); 
        
async function lastAction() {
    let s           = await Proc.findById(procID);
    s.lastAction    = func.nowTime();
    await s.save();
}
async function nextStage(procId) {
    let s           = await Proc.findById(procId);
    s.lastAction    = func.nowTime();
    if (s.stage > 8) {
        s.stage     = 0; // add save deal
        await addLog('Start new process');
    }
    else {
        s.stage     = s.stage + 1; 
        //await addLog(`Next stage: ${s.stage}`);
    }
    await s.save();
    return s.stage;
}
async function setStage(procId, nextStage) {
    let proc    = await Proc.findById(procId);
    proc.stage  = nextStage;
    if (nextStage == 6) { proc.profit -= 0.6; }
    if (nextStage == 7) { proc.profit -= 0.001 * 10; }
    if (nextStage == 10) { proc.profit -= proc.amountC * 0.0005; }
    await proc.save();
    await addLog(`${proc.strategy} stage ${proc.stage}`)
    return nextStage;
}
async function saveOrder(bot, orderType, order) {
    let proc    = await Proc.findById(bot.procId);
    if (order.status == 'closed') {
        proc[orderType + 'Price']   = order.average;
        proc[orderType + 'Closed']  = true;
        bot[orderType + 'Price']    = order.average;
        bot[orderType + 'Closed']   = true;
        let fee = 0; let k = 1;
        if (orderType.indexOf('orderUsdtUsdn') == -1) {
            if (orderType.indexOf('Left') > -1) { fee = 0.00075; }
            else                                { fee = 0.0005;  k = bot.rateRigh}
            console.log(proc.profit, order.average, proc.amount, fee)
            if (orderType.indexOf('Sell') > -1) { proc.profit += proc.amount * order.average * (1 - fee) / k; }
            else                                { proc.profit -= proc.amount * order.average * (1 + fee) / k; }
        }
        
        await addLog(`${proc.strategy}:${orderType} with price ${order.average.toFixed(2)} closed`);
        await proc.save();
    }
    return bot;
}
async function newOrder(bot, orderType, order) {
    let proc    = await Proc.findById(bot.procId);
    proc[orderType] = order.id;
    bot[orderType]  = order.id;
    proc[orderType + 'Price']   = bot[orderType + 'Price'];
    proc[orderType + 'Closed']  = false;
    bot[orderType + 'Closed']   = false;
    await addLog(`${proc.strategy}:${orderType} with price ${order.price.toFixed(2)} placed`);
    await proc.save();
    return bot;
}
async function addLog(t) {
    let log = new Log({text: t});
    await func.sendAlert(t);
    console.log(t)
    await log.save();
}
async function addScope(s, b) {
    let log = new Scope({buy: b, sell: s}); 
    await log.save();
}
async function getProcData(procId){
    let p = await Proc.findById(procId);
    return p;
}
async function addDeal(bot) {
    let d       = new Deal({procId: bot.procId, profit: 0, amount: bot.amount, startTime: func.nowTime()});
    await       d.save();
    let p       = await Proc.findById(bot.procId);
    p.dealId    = d._id;
    p.amount    = bot.amount;
    await       p.save();
    await       addLog(`${bot.strategy} Deal started with amount ${bot.amount}`)
    return      d._id;
}
async function saveDeal(proc){ 
    try {
        let d = await Deal.findById(proc.dealId);
        d.amount                = proc.amount;
        d.amountC               = proc.amountC;
        d.profit                = proc.profit;
        d.orderLeftBuy          = proc.orderLeftBuy;
        d.orderLeftSell         = proc.orderLeftSell;
        d.orderRighSell         = proc.orderRighSell;
        d.orderRighBuy          = proc.orderRighBuy;
        d.orderLeftBuyPrice     = proc.orderLeftBuyPrice;
        d.orderLeftSellPrice    = proc.orderLeftSellPrice;
        d.orderRighSellPrice    = proc.orderRighSellPrice;
        d.orderRighBuyPrice     = proc.orderRighBuyPrice;
        d.endedTime             = func.nowTime();
        await d.save();
        await addLog(`${proc.strategy}:Deal closed with ${d.profit.toFixed(2)} profit`);

        try {
            d = await Proc.findById(proc.procId);
            d.stage                 = 0;
            d.profit                = 0;
            d.orderLeftBuy          = '';
            d.orderLeftSell         = '';
            d.orderRighSell         = '';
            d.orderRighBuy          = '';
            d.orderLeftBuyClosed    = false;
            d.orderLeftSellClosed   = false;
            d.orderRighSellClosed   = false;
            d.orderRighBuyClosed    = false;
            d.orderLeftBuyPrice     = 0;
            d.orderLeftSellPrice    = 0;
            d.orderRighSellPrice    = 0;
            d.orderRighBuyPrice     = 0;
            d.dealId                = '';

            await d.save();
            return 0;
        } catch(err) { await addLog(err); return 8; }
    } catch(err) { await addLog(err); return 8; }
} 
async function addMask1() {
    let m = new Mask({
        strategy:   'RB3 4/6',
        profit:     0,
        procType:   'rebalance1',
        exchangeLeft:   'binance',
        exchangeRigh:   'wavesdex',
        pairLeft:   'WAVES/USDT',
        pairRigh:   'WAVES/USDN',
        pairLeftA:  'WAVES',
        pairLeftC:  'USDT',
        pairRighA:  'WAVES',
        pairRighC:  'USDN',
        balLeftA:   0,
        balLeftC:   0,
        balRighA:   0,
        balRighC:   0,
        rateLeft:   1.0,
        rateRigh:   1.015,
        disbalLeft:         0.4,
        disbalRigh:         0.4,
        disbalRebal:        0.6,
        amount:             0,
        amountC:            300,     
        stage:              0,
        orderLeftBuy:       '',
        orderRighBuy:       '',
        orderLeftSell:      '',
        orderRighSell:      '',
        orderLeftBuyPrice:  0,
        orderRighBuyPrice:  0,
        orderLeftSellPrice: 0,
        orderRighSellPrice: 0,
        orderUsdtUsdn:      '',
        orderUsdtUsdnClosed:false,
        orderUsdtUsdnPrice: 0,
        orderLeftBuyClosed: false,
        orderRighBuyClosed: false,
        orderLeftSellClosed:false,
        orderRighSellClosed:false,
        botId:              '',
        procId:             '',
        dealId:             '',
        enabled:            true,
    
    });
    let p   = new Proc(m);
    p.botId = m._id; 
    m.botId = m._id; 
    m.procId= p._id;
    p.procId= p._id;
    await p.save(); 
    await m.save();
    console.log(p._id, 'process created');
    console.log(m._id, 'mask created');

}

async function addTest(data) {
    let test = new Test(data);
    console.log(test)
    await test.save();
}

module.exports.lastAction       = lastAction;
module.exports.nextStage        = nextStage;
module.exports.setStage         = setStage;
module.exports.addLog           = addLog;
module.exports.addScope         = addScope;
module.exports.newOrder         = newOrder;
module.exports.saveOrder        = saveOrder;
module.exports.getProcData      = getProcData;
module.exports.saveDeal         = saveDeal;
module.exports.addDeal          = addDeal;
module.exports.addMask1         = addMask1;
module.exports.addTest          = addTest;


