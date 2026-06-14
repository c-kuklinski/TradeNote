import axios from 'axios'
import Parse from 'parse/dist/parse.min.js'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
dayjs.extend(utc)

const MAX_SAVE_BATCH = 50
const PRICE_DATA_CLASS = 'priceData'

const getSafeSymbol = (symbol) => {
    if (!symbol || typeof symbol !== 'string') return ''
    return symbol.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
}

const getPriceFieldName = (symbol) => {
    const safe = getSafeSymbol(symbol)
    return safe || ''
}

const ensurePriceDataField = async (symbol) => {
    const safe = getSafeSymbol(symbol)
    if (!safe) return
    try {
        if (safe === 'DAYS') {
            await axios.post('/api/price-data/ensure-structure')
        } else {
            await axios.post('/api/price-data/ensure-field', { symbol: safe })
        }
    } catch (error) {
        console.warn('Unable to ensure priceData field for', safe, error?.message || error)
    }
}

const buildPriceElement = (symbol, candle, options) => {
    const timestampMs = Number(candle.t || candle.timestamp || candle.timestampUnix || candle.ts)
    const utcOffset = options.utcOffset || (timestampMs ? dayjs(timestampMs).format('Z') : dayjs().format('Z'))
    const timeframe = options.timeframe || '1m'

    const el = {}
    if (Number.isFinite(timestampMs)) {
        el.timestamp = new Date(timestampMs)
        el.timestampUnix = timestampMs
        el.dateUnixDay = Math.floor(timestampMs / 86400000)
    }
    el.utcOffset = utcOffset
    el.timeframe = timeframe
    if (options.type) el.type = options.type
    if (options.exchange) el.exchange = options.exchange
    if (options.contract) el.contract = options.contract

    const openValue = Number(candle.o)
    const highValue = Number(candle.h)
    const lowValue = Number(candle.l)
    const closeValue = Number(candle.c)
    const volumeValue = Number(candle.v || candle.volume || 0)
    const deltaValue = Number(candle.delta || 0)

    if (Number.isFinite(openValue)) el.open = openValue
    if (Number.isFinite(highValue)) el.high = highValue
    if (Number.isFinite(lowValue)) el.low = lowValue
    if (Number.isFinite(closeValue)) el.close = closeValue
    if (Number.isFinite(volumeValue)) el.volume = volumeValue
    if (Number.isFinite(deltaValue)) el.delta = deltaValue

    // keep original symbol for clarity
    el.symbol = symbol
    return el
}

export async function useSavePriceData(symbol, ohlcv, options = {}) {
    if (!symbol || !Array.isArray(ohlcv) || ohlcv.length === 0) {
        return 0
    }
    const currentUser = Parse.User.current()
    if (!currentUser) {
        throw new Error('User must be logged in to save price data.')
    }

    const timeframe = options.timeframe || '1m'

    // ensure the priceData schema has the per-symbol/day structure
    try { await ensurePriceDataField('days') } catch (e) { /* ignore */ }

    // Group incoming candles by day (dateUnixDay)
    const grouped = {}
    for (const c of ohlcv) {
        const ts = Number(c.t || c.timestamp || c.timestampUnix || c.ts)
        const day = Number.isFinite(ts) ? Math.floor(ts / 86400000) : null
        if (!grouped[day]) grouped[day] = []
        grouped[day].push(c)
    }

    // Find or create per-user + per-symbol document
    const PriceDataObj = Parse.Object.extend(PRICE_DATA_CLASS)
    const q = new Parse.Query(PriceDataObj)
    q.equalTo('user', currentUser)
    q.equalTo('symbol', symbol)
    let doc = await q.first()
    if (!doc) {
        doc = new Parse.Object(PRICE_DATA_CLASS)
        doc.set('user', currentUser)
        doc.set('symbol', symbol)
        doc.setACL(new Parse.ACL(currentUser))
    }

    const existingDays = Array.isArray(doc.get('days')) ? doc.get('days') : []
    const existingMap = new Map()
    for (const dayEntry of existingDays) {
        if (dayEntry && Number.isFinite(Number(dayEntry.dateUnixDay))) {
            existingMap.set(Number(dayEntry.dateUnixDay), Array.isArray(dayEntry.candles) ? dayEntry.candles.slice() : [])
        }
    }

    let added = 0
    for (const [dayKey, candles] of Object.entries(grouped)) {
        const dayNum = dayKey === 'null' ? null : Number(dayKey)
        if (!Array.isArray(candles) || candles.length === 0) continue
        const existingCandles = existingMap.get(dayNum) || []
        const existingTs = new Set(existingCandles.map((e) => Number(e && e.timestampUnix)).filter((t) => Number.isFinite(t)))
        const newEls = []
        for (const c of candles) {
            const ts = Number(c.t || c.timestamp || c.timestampUnix || c.ts)
            if (Number.isFinite(ts) && existingTs.has(ts)) continue
            newEls.push(buildPriceElement(symbol, c, options))
        }
        if (newEls.length === 0) continue
        const merged = existingCandles.concat(newEls)
        merged.sort((a, b) => Number(a.timestampUnix || 0) - Number(b.timestampUnix || 0))
        existingMap.set(dayNum, merged)
        added += newEls.length
    }

    // Recompose days array
    const daysArr = []
    for (const [dayNum, candles] of existingMap.entries()) {
        daysArr.push({ dateUnixDay: dayNum, candles })
    }
    daysArr.sort((a, b) => {
        const da = a && Number(a.dateUnixDay)
        const db = b && Number(b.dateUnixDay)
        if (Number.isFinite(da) && Number.isFinite(db)) return da - db
        if (Number.isFinite(da)) return -1
        if (Number.isFinite(db)) return 1
        return 0
    })

    doc.set('days', daysArr)
    await doc.save()
    return added
}

export async function useGetPriceData(symbol, startUnix, endUnix, limit = 10000, timeframe) {
    const currentUser = Parse.User.current()
    if (!currentUser) {
        throw new Error('User must be logged in to query price data.')
    }

    // Try per-user per-symbol doc with days
    const PriceDataObj = Parse.Object.extend(PRICE_DATA_CLASS)
    const q = new Parse.Query(PriceDataObj)
    q.equalTo('user', currentUser)
    q.equalTo('symbol', symbol)
    const doc = await q.first()
    console.log(`[useGetPriceData] Query for symbol="${symbol}", found doc:`, !!doc, doc ? `with ${Array.isArray(doc.get('days')) ? doc.get('days').length : 0} days` : '')

    if (doc && Array.isArray(doc.get('days'))) {
        let arr = []
        for (const dayEntry of doc.get('days')) {
            if (!dayEntry || !Array.isArray(dayEntry.candles)) continue
            arr = arr.concat(dayEntry.candles)
        }
        console.log(`[useGetPriceData] Flattened ${arr.length} candles from days array`)
        if (timeframe) arr = arr.filter((e) => e && e.timeframe === timeframe)
        if (Number.isFinite(startUnix)) arr = arr.filter((e) => Number(e && e.timestampUnix) >= Number(startUnix))
        if (Number.isFinite(endUnix)) arr = arr.filter((e) => Number(e && e.timestampUnix) <= Number(endUnix))
        console.log(`[useGetPriceData] After filters: ${arr.length} candles (timeframe=${timeframe}, startUnix=${startUnix}, endUnix=${endUnix})`)
        arr.sort((a, b) => Number(a.timestampUnix || 0) - Number(b.timestampUnix || 0))
        return arr.slice(0, limit)
    }

    // Fallback to legacy per-candle entries
    console.log(`[useGetPriceData] Data not found in days structure, falling back to legacy query for symbol="${symbol}", timeframe="${timeframe}", startUnix=${startUnix}, endUnix=${endUnix}`)
    const DatabaseObj = Parse.Object.extend(PRICE_DATA_CLASS)
    const DatabaseQuery = new Parse.Query(DatabaseObj)
    DatabaseQuery.equalTo('user', currentUser)
    if (symbol) DatabaseQuery.equalTo('symbol', symbol)
    if (timeframe) DatabaseQuery.equalTo('timeframe', timeframe)
    if (Number.isFinite(startUnix)) DatabaseQuery.greaterThanOrEqualTo('timestampUnix', Number(startUnix))
    if (Number.isFinite(endUnix)) DatabaseQuery.lessThanOrEqualTo('timestampUnix', Number(endUnix))
    DatabaseQuery.ascending('timestampUnix')
    DatabaseQuery.limit(limit)
    const results = await DatabaseQuery.find()
    console.log(`[useGetPriceData] Query returned ${results.length} candles`)
    return JSON.parse(JSON.stringify(results))
}
