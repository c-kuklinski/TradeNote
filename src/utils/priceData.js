import Parse from 'parse/dist/parse.min.js'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
dayjs.extend(utc)

const MAX_SAVE_BATCH = 50

const buildPriceObject = (symbol, candle, options, user) => {
    const priceObject = new Parse.Object('priceData')
    const timestampMs = Number(candle.t || candle.timestamp || candle.timestampUnix || candle.ts)
    const utcOffset = options.utcOffset || (timestampMs ? dayjs(timestampMs).format('Z') : dayjs().format('Z'))
    const timeframe = options.timeframe || '1m'

    priceObject.set('symbol', symbol)
    if (Number.isFinite(timestampMs)) {
        priceObject.set('timestamp', new Date(timestampMs))
        priceObject.set('timestampUnix', timestampMs)
        priceObject.set('dateUnixDay', Math.floor(timestampMs / 86400000))
    }
    priceObject.set('utcOffset', utcOffset)
    priceObject.set('timeframe', timeframe)
    if (options.type) priceObject.set('type', options.type)
    if (options.exchange) priceObject.set('exchange', options.exchange)
    if (options.contract) priceObject.set('contract', options.contract)

    const openValue = Number(candle.o)
    const highValue = Number(candle.h)
    const lowValue = Number(candle.l)
    const closeValue = Number(candle.c)
    const volumeValue = Number(candle.v || candle.volume || 0)
    const deltaValue = Number(candle.delta || 0)

    if (Number.isFinite(openValue)) priceObject.set('open', openValue)
    if (Number.isFinite(highValue)) priceObject.set('high', highValue)
    if (Number.isFinite(lowValue)) priceObject.set('low', lowValue)
    if (Number.isFinite(closeValue)) priceObject.set('close', closeValue)
    if (Number.isFinite(volumeValue)) priceObject.set('volume', volumeValue)
    if (Number.isFinite(deltaValue)) priceObject.set('delta', deltaValue)

    priceObject.set('user', user)
    priceObject.setACL(new Parse.ACL(user))
    return priceObject
}

export async function useSavePriceData(symbol, ohlcv, options = {}) {
    if (!symbol || !Array.isArray(ohlcv) || ohlcv.length === 0) {
        return 0
    }
    const currentUser = Parse.User.current()
    if (!currentUser) {
        throw new Error('User must be logged in to save price data.')
    }

    let savedCount = 0
    for (let i = 0; i < ohlcv.length; i += MAX_SAVE_BATCH) {
        const chunk = ohlcv.slice(i, i + MAX_SAVE_BATCH).map((candle) => buildPriceObject(symbol, candle, options, currentUser))
        await Parse.Object.saveAll(chunk)
        savedCount += chunk.length
    }

    return savedCount
}

export async function useGetPriceData(symbol, startUnix, endUnix, limit = 10000, timeframe) {
    const currentUser = Parse.User.current()
    if (!currentUser) {
        throw new Error('User must be logged in to query price data.')
    }

    const parseObject = Parse.Object.extend('priceData')
    const query = new Parse.Query(parseObject)
    query.equalTo('user', currentUser)
    if (symbol) query.equalTo('symbol', symbol)
    if (timeframe) query.equalTo('timeframe', timeframe)
    if (Number.isFinite(startUnix)) query.greaterThanOrEqualTo('timestampUnix', Number(startUnix))
    if (Number.isFinite(endUnix)) query.lessThanOrEqualTo('timestampUnix', Number(endUnix))
    query.ascending('timestampUnix')
    query.limit(limit)

    const results = await query.find()
    return JSON.parse(JSON.stringify(results))
}
