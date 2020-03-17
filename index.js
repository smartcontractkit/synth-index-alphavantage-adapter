const rp = require('request-promise')
const snx = require('synthetix')
const Decimal = require('decimal.js')

const getPriceData = async (synth) => {
  try {
    return await rp({
      url: `https://www.alphavantage.co/query`,
      qs: {
        function: 'CURRENCY_EXCHANGE_RATE',
        from_currency: synth,
        to_currency: 'USD',
        apikey: process.env.API_KEY
      },
      json: true
    })
  } catch (error) {
    throw error.message
  }
}

const calculateIndex = (indexes) => {
  let value = new Decimal(0)
  try {
    indexes.forEach(i => {
      value = value.plus(new Decimal(i.units).times(new Decimal(i.priceData['Realtime Currency Exchange Rate']['5. Exchange Rate'])))
    })
  } catch (error) {
    throw error.message
  }
  return value.toNumber()
}

const createRequest = async (input, callback) => {
  const asset = input.data.asset || 'sCEX'
  const datas = snx.getSynths({network: 'mainnet'}).filter(({index, inverted}) => index && !inverted)
  const data = datas.find(d => d.name.toLowerCase() === asset.toLowerCase())
  try {
    await Promise.all(data.index.map(async (synth) => {
      synth.priceData = await getPriceData(synth.symbol)
    }))
    data.result = calculateIndex(data.index)
    callback(200, {
      jobRunID: input.id,
      data: data,
      result: data.result,
      statusCode: 200
    })
  } catch (error) {
    callback(500, {
      jobRunID: input.id,
      status: 'errored',
      error: error,
      statusCode: 500
    })
  }
}

exports.gcpservice = (req, res) => {
  createRequest(req.body, (statusCode, data) => {
    res.status(statusCode).send(data)
  })
}

exports.handler = (event, context, callback) => {
  createRequest(event, (statusCode, data) => {
    callback(null, data)
  })
}

exports.handlerv2 = (event, context, callback) => {
  createRequest(JSON.parse(event.body), (statusCode, data) => {
    callback(null, {
      statusCode: statusCode,
      body: JSON.stringify(data),
      isBase64Encoded: false
    })
  })
}

module.exports.createRequest = createRequest
