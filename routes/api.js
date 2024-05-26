'use strict';
let mongodb = require('mongodb');
let mongoose = require('mongoose');
let XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
module.exports = function (app) {
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://adaitran771:12345678910@freecodecamp.lzvpupa.mongodb.net/?retryWrites=true&w=majority&appName=freecodecamp";
try {
   mongoose.connect(uri);
} catch (error) {
  handleError(error);
}
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
// const client = new MongoClient(uri, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   }
// });
// async function run() {
//   try {
//     // Connect the client to the server	(optional starting in v4.7)
//     await client.connect();
//     // Send a ping to confirm a successful connection
//     await client.db("stock_price_checker").command({ ping: 1 });
//     console.log("Pinged your deployment. You successfully connected to MongoDB!");
//   } finally {
//     // Ensures that the client will close when you finish/error
//     await client.close();
//   }
// }
// run().catch(console.dir);
let stockSchema = new mongoose.Schema({
  name: {type: String, required: true},
  likes: {type: Number, default: 0},
  ips: [String]
})

let Stock = mongoose.model('Stock', stockSchema)

  app.route('/api/stock-prices')
    .get(function (req, res){
      let responseObject = {}
      responseObject['stockData'] = {}

      // Variable to determine number of stocks
      let twoStocks = false

      /* Output Response */
      let outputResponse = () => {
          return res.json(responseObject)
      }

      /* Find/Update Stock Document */
      let findOrUpdateStock = (stockName, documentUpdate, nextStep) => {
        Stock.findOneAndUpdate({ name: stockName }, documentUpdate, { new: true, upsert: true })
          .then(stockDocument => {
            if (stockDocument) {
              if (twoStocks === false) {
                return nextStep(stockDocument, processOneStock);
              } else {
                return nextStep(stockDocument, processTwoStocks);
              }
            }
          })
          .catch(error => {
            console.log(error);
          });
      };

      /* Like Stock */
      let likeStock = (stockName, nextStep) => {
        Stock.findOne({ name: stockName })
          .exec()
          .then(stockDocument => {
            if (stockDocument && stockDocument['ips'] && stockDocument['ips'].includes(req.ip)) {
              return res.json('Error: Only 1 Like per IP Allowed');
            } else {
              let documentUpdate = { $inc: { likes: 1 }, $push: { ips: req.ip } };
              nextStep(stockName, documentUpdate, getPrice);
            }
          })
          .catch(error => {
            console.log(error);
          });
      };

      /* Get Price */
      let getPrice = (stockDocument, nextStep) => {
        let requestUrl = `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stockDocument['name']}/quote`;
      
        fetch(requestUrl)
          .then(response => response.json())
          .then(apiResponse => {
            stockDocument['price'] = Number(Number(apiResponse['latestPrice']).toFixed(2));
            nextStep(stockDocument, outputResponse);
          })
          .catch(error => {
            console.log(error);
          });
      };

      /* Build Response for 1 Stock */
      let processOneStock = (stockDocument, nextStep) => {
        responseObject['stockData']['stock'] = stockDocument['name']
        responseObject['stockData']['price'] = stockDocument['price']
        responseObject['stockData']['likes'] = stockDocument['likes']
        nextStep()
      }

      let stocks = []        
      /* Build Response for 2 Stocks */
      let processTwoStocks = (stockDocument, nextStep) => {
        let newStock = {}
        newStock['stock'] = stockDocument['name']
        newStock['price'] = stockDocument['price']
        newStock['likes'] = stockDocument['likes']
        stocks.push(newStock)
        if(stocks.length === 2){
          stocks[0]['rel_likes'] = stocks[0]['likes'] - stocks[1]['likes']
          stocks[1]['rel_likes'] = stocks[1]['likes'] - stocks[0]['likes']
          responseObject['stockData'] = stocks
          nextStep()
        }else{
          return
        }
      }

      /* Process Input*/  
      if(typeof (req.query.stock) === 'string'){
        /* One Stock */
        let stockName = req.query.stock
        
        let documentUpdate = {}
        if(req.query.like && req.query.like === 'true'){
            likeStock(stockName, findOrUpdateStock)
        }else{
            findOrUpdateStock(stockName, documentUpdate, getPrice)
        }


      } else if (Array.isArray(req.query.stock)){
        twoStocks = true
        
        /* Stock 1 */
        let stockName = req.query.stock[0]
        if(req.query.like && req.query.like === 'true'){
            likeStock(stockName, findOrUpdateStock)
        }else{
            let documentUpdate = {}
            findOrUpdateStock(stockName, documentUpdate, getPrice)
        }

        /* Stock 2 */
        stockName = req.query.stock[1]
        if(req.query.like && req.query.like === 'true'){
            likeStock(stockName, findOrUpdateStock)
        }else{
            let documentUpdate = {}
            findOrUpdateStock(stockName, documentUpdate, getPrice)
        }


      }
      
      
      
    });
    
};
