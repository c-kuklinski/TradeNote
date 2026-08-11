<script setup>
import { onBeforeMount, onMounted, computed, reactive, ref } from 'vue';
import Filters from '../components/Filters.vue'
import NoData from '../components/NoData.vue';
import SpinnerLoadingPage from '../components/SpinnerLoadingPage.vue';
import Calendar from '../components/Calendar.vue';
import Screenshot from '../components/Screenshot.vue'

import { spinnerLoadingPage, calendarData, filteredTrades, screenshots, diaries, modalDailyTradeOpen, amountCase, markerAreaOpen, screenshot, tradeScreenshotChanged, excursion, tradeExcursionChanged, spinnerSetups, spinnerSetupsText, tradeExcursionId, tradeExcursionDateUnix, hasData, tradeId, excursions, saveButton, itemTradeIndex, tradeIndex, tradeIndexPrevious, spinnerLoadMore, endOfList, selectedGrossNet, availableTags, tradeTagsChanged, tagInput, tags, tradeTags, showTagsList, selectedTagIndex, tradeTagsId, tradeTagsDateUnix, newTradeTags, notes, tradeNote, tradeNoteChanged, tradeNoteDateUnix, tradeNoteId, availableTagsArray, timeZoneTrade, screenshotsInfos, idCurrentType, idCurrentNumber, tabGettingScreenshots, currentUser, apis, satisfactionTradeArray, satisfactionArray } from '../stores/globals';

import { useCreatedDateFormat, useTwoDecCurrencyFormat, useTimeFormat, useTimeDuration, useMountDaily, useGetSelectedRange, useLoadMore, useCheckVisibleScreen, useDecimalsArithmetic, useInitTooltip, useDateCalFormat, useSwingDuration, useStartOfDay, useInitTab } from '../utils/utils';

import { useSetupImageUpload, useSaveScreenshot, useGetScreenshots } from '../utils/screenshots';

import { useGetExcursions, useGetTags, useGetAvailableTags, useUpdateAvailableTags, useUpdateTags, useFindHighestIdNumber, useFindHighestIdNumberTradeTags, useUpdateNote, useGetNotes, useGetTagInfo, useCreateAvailableTagsArray, useFilterSuggestions, useTradeTagsChange, useFilterTags, useToggleTagsDropdown, useResetTags, useDailySatisfactionChange } from '../utils/daily';

import { useCandlestickChart } from '../utils/charts';

import { useGetMFEPrices } from '../utils/addTrades';
import { useSavePriceData, useGetPriceData } from '../utils/priceData';

/* MODULES */
import Parse from 'parse/dist/parse.min.js'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
dayjs.extend(utc)
import isoWeek from 'dayjs/plugin/isoWeek.js'
dayjs.extend(isoWeek)
import timezone from 'dayjs/plugin/timezone.js'
dayjs.extend(timezone)
import duration from 'dayjs/plugin/duration.js'
dayjs.extend(duration)
import updateLocale from 'dayjs/plugin/updateLocale.js'
dayjs.extend(updateLocale)
import localizedFormat from 'dayjs/plugin/localizedFormat.js'
dayjs.extend(localizedFormat)
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
dayjs.extend(customParseFormat)
import axios from 'axios'
import { useCreateOHLCV } from '../utils/addTrades';


const dailyTabs = [{
    id: "trades",
    label: "Trades",
    target: "#tradesNav"
},
{
    id: "blotter",
    label: "Blotter",
    target: "#blotterNav"
},
{
    id: "screenshots",
    label: "Screenshots",
    target: "#screenshotsNav"
},
{
    id: "diaries",
    label: "Diary",
    target: "#diariesNav"
},
]

let tradesModal = null
let tagsModal = null

let tradeSatisfactionId
let tradeSatisfaction
let tradeSatisfactionDateUnix


let ohlcArray = [] // array used for charts
let ohlcv = [] // array used for MFE / excursion calculation (same as in addTrades.js)


const candlestickChartFailureMessage = ref(null)
const apiIndex = ref(-1)
const apiKey = ref(null)
const apiSource = ref(null)
const crossTradingActive = ref(true)
// move crossTrading to settings
onBeforeMount(async () => {

})
onMounted(async () => {
    await useMountDaily()
    await useInitTooltip()
    useCreateAvailableTagsArray()

    tradesModal = new bootstrap.Modal("#tradesModal")
    document.getElementById("tradesModal").addEventListener('shown.bs.modal', async (event) => {
        const caller = event.relatedTarget
        const index = caller.dataset.index
        const index2 = caller.dataset.indextwo
        clickTradesModal(index, index2, index2)
    })

    tagsModal = new bootstrap.Modal("#tagsModal")
    document.getElementById("tagsModal").addEventListener('shown.bs.modal', async (event) => {
        const caller = event.relatedTarget
        const index = caller.dataset.index
        clickTagsModal(index)
    })
})


/**************
 * MODAL INTERACTION
 ***************/
let loadScreenshots = false
let initCandleChart = true // needed to init or not candlestickCharts in useCandlestickChart
 
async function clickTradesModal(param1, param2, param3) {
    //param1 : itemTradeIndex : index inside filteredtrades. This is only defined on first click/when we open modal and not on next or previous
    //param2 : also called tradeIndex, is the index inside the trades (= index of itemTrade.trades)
    //param3 : tradeIndex back or next, so with -1 or +1. On modal open, param3 = param2
    //console.log(" param 3 "+JSON.stringify(param3))
    //console.log("param1 " + param1)
    //console.log("param2 " + param2)
    //console.log("param3 " + param3)
    //console.log(" clicking ")

    if (markerAreaOpen.value == true) {
        alert("Please save your screenshot annotation")
        return
    } else {
        await (spinnerSetups.value = true)

        if (tradeNoteChanged.value) {
            await useUpdateNote()
            await useGetNotes()
        }

        if (tradeExcursionChanged.value) {
            await updateExcursions()
        }

        if (tradeTagsChanged.value) {
            await Promise.all([useUpdateAvailableTags(), useUpdateTags()])
            await Promise.all([useGetTags(), useGetAvailableTags()])
            useCreateAvailableTagsArray()
        }

        if (tradeScreenshotChanged.value) {
            await useSaveScreenshot()
        }


        tradeNoteChanged.value = false
        tradeExcursionChanged.value = false
        tradeScreenshotChanged.value = false
        tradeTagsChanged.value = false

        showTagsList.value = false


        if (param1 === undefined && param2 === undefined && param3 === undefined) {
            //console.log(" -> Closing Modal")
            await (spinnerSetups.value = false)

            itemTradeIndex.value = undefined
            tradeIndexPrevious.value = undefined
            tradeIndex.value = undefined

            tradeNoteChanged.value = false
            tradeExcursionChanged.value = false
            tradeScreenshotChanged.value = false
            tradeTagsChanged.value = false

            showTagsList.value = false

            tradesModal.hide()
            await (modalDailyTradeOpen.value = false) //this is important because we use itemTradeIndex on filteredTrades and if change month, this causes problems. So only show modal content when clicked on open modal/v-if
            await useInitTab("daily")
            loadScreenshots = false
            initCandleChart = true
        }
        else {
            //console.log(" -> Opening Modal or clicking next/back")
            itemTradeIndex.value = Number(param1)
            tradeIndexPrevious.value = Number(param2)
            tradeIndex.value = Number(param3)

            apiIndex.value = -1
            let databentoIndex = apis.findIndex(obj => obj.provider === "databento")
            let polygonIndex = apis.findIndex(obj => obj.provider === "polygon")

            if (databentoIndex > -1 && apis[databentoIndex].key != "") {
                apiIndex.value = databentoIndex
                apiSource.value = "databento"
            } else if (polygonIndex > -1 && apis[polygonIndex].key != "") {
                apiIndex.value = polygonIndex
                apiSource.value = "polygon"
            }

            let awaitClick = async () => {

                modalDailyTradeOpen.value = true

                if (loadScreenshots === false) {
                    let screenshotsDate = filteredTrades[param1].dateUnix

                    if (screenshots.length == 0 || (screenshots.length > 0 && screenshots[0].dateUnixDay != screenshotsDate)) {
                        console.log("  --> getting Screenshots")
                        await useGetScreenshots(true, screenshotsDate)
                    } else {
                        console.log("  --> Screenshots already stored")
                    }
                    loadScreenshots = true
                }

                let filteredTradeId = filteredTrades[itemTradeIndex.value].trades[param3].id
                await Promise.all([resetExcursion(), useResetTags()])

                //For setups I have added setups into filteredTrades. For screenshots and excursions I need to find so I create on each modal page a screenshot and excursion object
                let findScreenshot = screenshots.find(obj => obj.name == filteredTradeId)
                for (let key in screenshot) delete screenshot[key]
                candlestickChartFailureMessage.value = null // to avoid message when screenshot is present

                if (findScreenshot) {
                    //console.log(" found screenshot")
                    for (let key in findScreenshot) {
                        screenshot[key] = findScreenshot[key]
                    }
                } else {
                    screenshot.side = null
                    screenshot.type = null

                    /* GET OHLC / CANDLESTICK CHARTS */
                    let filteredTradesObject = filteredTrades[itemTradeIndex.value].trades[param3]
                    const dbLoaded = await loadSavedPriceData(filteredTradesObject)
                    if (!dbLoaded) {
                        if (apiIndex.value != -1) {
                            apiKey.value = apis[apiIndex.value].key
                            try {
                                candlestickChartFailureMessage.value = null
                                let ohlcTimestamps
                                let ohlcPrices
                                let ohlcVolumes
                                if (ohlcArray.length == 0) {
                                    console.log(" -> No symbol/date in ohlcArray")
                                    await getOHLC(filteredTradesObject.td, filteredTradesObject.symbol, filteredTradesObject.type)
                                    ohlcTimestamps = ohlcArray[0].ohlcTimestamps
                                    ohlcPrices = ohlcArray[0].ohlcPrices
                                    ohlcVolumes = ohlcArray[0].ohlcVolumes

                                } else {
                                    let index = ohlcArray.findIndex(obj => obj.date == filteredTradesObject.td && obj.symbol == filteredTradesObject.symbol)

                                    if (index != -1) {
                                        console.log(" -> Symbol and/or date exists in ohlcArray")
                                        ohlcTimestamps = ohlcArray[index].ohlcTimestamps
                                        ohlcPrices = ohlcArray[index].ohlcPrices
                                        ohlcVolumes = ohlcArray[index].ohlcVolumes
                                    } else {
                                        console.log(" -> Symbol and/or date does not exist in ohlcArray")
                                        await getOHLC(filteredTradesObject.td, filteredTradesObject.symbol, filteredTradesObject.type)
                                        let index = ohlcArray.findIndex(obj => obj.date === filteredTradesObject.td && obj.symbol === filteredTradesObject.symbol)
                                        if (index != -1) {
                                            ohlcTimestamps = ohlcArray[index].ohlcTimestamps
                                            ohlcPrices = ohlcArray[index].ohlcPrices
                                            ohlcVolumes = ohlcArray[index].ohlcVolumes
                                        } else {
                                            console.log(" -> there's an issues with OHLC")
                                        }
                                    }
                                }
                                await useCandlestickChart(ohlcTimestamps, ohlcPrices, ohlcVolumes, filteredTradesObject, initCandleChart)
                                initCandleChart = false

                            } catch (error) {
                                if (error.response && error.response.status === 429) {
                                    candlestickChartFailureMessage.value = "Too many requests, try again later"
                                }
                                else if (error.response) {
                                    candlestickChartFailureMessage.value = error.response.statusText
                                }
                                else {
                                    candlestickChartFailureMessage.value = error
                                }
                                console.error(error)
                            }
                        } else {
                            candlestickChartFailureMessage.value = "No OHLC data available for this symbol/date. Upload CSV, JSON or add an API key."
                        }
                    }
                }

                //We differentiate
                //1- tags on daily page : they are a function of available tags
                //2- tags in modal (here): they need to have id and name because if we add a new tag, we need the json with id and name
                let findTags = tags.find(obj => obj.tradeId == filteredTradeId)
                if (findTags) {
                    findTags.tags.forEach(element => {
                        for (let obj of availableTags) {
                            for (let tag of obj.tags) {
                                if (tag.id === element) {
                                    let temp = {}
                                    temp.id = tag.id
                                    temp.name = tag.name
                                    tradeTags.push(temp)
                                }
                            }
                        }
                    });
                }

                let noteIndex = notes.findIndex(obj => obj.tradeId == filteredTradeId)
                tradeNote.value = null
                if (noteIndex != -1) {
                    tradeNote.value = notes[noteIndex].note
                }

                let findExcursion = excursions.filter(obj => obj.tradeId == filteredTradeId)
                if (findExcursion.length) {
                    findExcursion[0].stopLoss != null ? excursion.stopLoss = findExcursion[0].stopLoss : null
                    findExcursion[0].maePrice != null ? excursion.maePrice = findExcursion[0].maePrice : null
                    findExcursion[0].mfePrice != null ? excursion.mfePrice = findExcursion[0].mfePrice : null
                    //console.log(" tradeExcursion "+JSON.stringify(tradeExcursion))
                }

                //let findSatisfaction = excursions.filter(obj => obj.tradeId == filteredTradeId)
                console.log(" satisfactionTradeArray "+JSON.stringify(satisfactionArray))
                if (findExcursion.length) {
                    findExcursion[0].stopLoss != null ? excursion.stopLoss = findExcursion[0].stopLoss : null
                    findExcursion[0].maePrice != null ? excursion.maePrice = findExcursion[0].maePrice : null
                    findExcursion[0].mfePrice != null ? excursion.mfePrice = findExcursion[0].mfePrice : null
                    //console.log(" tradeExcursion "+JSON.stringify(tradeExcursion))
                }

                //if (firstTimeOpen) firstTimeOpen = false
            }
            await awaitClick()
            await (spinnerSetups.value = false)
            tagInput.value = ''
            saveButton.value = false
            await useInitTooltip()
        }

    }

}

const clickTagsModal = (param1) => {
    itemTradeIndex.value = Number(param1)
    tradeTags.length = 0
    let findTags = tags.find(obj => obj.tradeId == filteredTrades[itemTradeIndex.value].dateUnix)
    if (findTags) {
        findTags.tags.forEach(element => {
            for (let obj of availableTags) {
                for (let tag of obj.tags) {
                    if (tag.id === element) {
                        let temp = {}
                        temp.id = tag.id
                        temp.name = tag.name
                        tradeTags.push(temp)
                    }
                }
            }
        });
    }
}

const saveDailyTags = async () => {
    if (tradeTagsChanged.value) {
        await Promise.all([useUpdateAvailableTags(), useUpdateTags()])
        await Promise.all([useGetTags(), useGetAvailableTags()])
    }
    tradeTagsChanged.value = false
    closeTagsModal()
}

const closeTagsModal = async () => {
    tradeTags.length = 0
    tagsModal.hide()
}

const checkDate = ((param1, param2) => {
    //console.log("param 1 "+param1)
    //console.log("param 2 "+param2)
    let tdDateUnix = dayjs(param1 * 1000).tz(timeZoneTrade.value)
    let tradeDateUnix = dayjs(param2 * 1000).tz(timeZoneTrade.value)
    let check = tdDateUnix.isSame(tradeDateUnix, 'day')
    return check
})

/**************
 * SATISFACTION
 ***************/



async function tradeSatisfactionChange(param1, param2) {
    tradeSatisfactionId = param1.id
    tradeSatisfactionDateUnix = param1.td
    tradeSatisfaction = param2
    param1.satisfaction = tradeSatisfaction
    await updateTradeSatisfaction()

}

async function updateTradeSatisfaction() { //param1 : daily unixDate ; param2 : true / false ; param3: dateUnixDay ; param4: tradeId
    console.log("\nUPDATING OR SAVING TRADES SATISFACTION IN PARSE")
    return new Promise(async (resolve, reject) => {
        const parseObject = Parse.Object.extend("satisfactions");
        const query = new Parse.Query(parseObject);
        query.equalTo("tradeId", tradeSatisfactionId)
        const results = await query.first();
        if (results) {
            console.log(" -> Updating satisfaction")
            results.set("satisfaction", tradeSatisfaction)

            results.save()
                .then(async () => {
                    console.log(' -> Updated satisfaction with id ' + results.id + " to " + tradeSatisfaction)
                    //spinnerSetupsText.value = "Updated setup"
                }, (error) => {
                    console.log('Failed to create new object, with error code: ' + error.message);
                })
        } else {
            console.log(" -> Saving satisfaction")

            const object = new parseObject();
            object.set("user", Parse.User.current())
            object.set("dateUnix", tradeSatisfactionDateUnix)
            object.set("tradeId", tradeSatisfactionId)
            object.set("satisfaction", tradeSatisfaction)
            object.setACL(new Parse.ACL(Parse.User.current()));
            object.save()
                .then(async (object) => {
                    console.log(' -> Added new satisfaction with id ' + object.id)
                    //spinnerSetupsText.value = "Added new setup"
                }, (error) => {
                    console.log('Failed to create new object, with error code: ' + error.message);
                })
        }
        resolve()


    })
}

/**************
 * EXCURSIONS
 ***************/

function tradeExcursionClicked() {
    //console.log("click")
    tradeExcursionChanged.value = true
    saveButton.value = true
}
function tradeExcursionChange(param1, param2) {
    console.log("param 1: " + param1 + " param2: " + param2)
    if (param2 == "stopLoss") {
        if (param1) {
            excursion.stopLoss = parseFloat(param1)
        } else {
            excursion.stopLoss = null
        }

    }
    if (param2 == "maePrice") {
        excursion.maePrice = parseFloat(param1)
    }
    if (param2 == "mfePrice") {
        excursion.mfePrice = parseFloat(param1)
    }
    tradeExcursionDateUnix.value = filteredTrades[itemTradeIndex.value].dateUnix
    tradeExcursionId.value = filteredTrades[itemTradeIndex.value].trades[tradeIndex.value].id
    //console.log("Excursion has changed: " + JSON.stringify(excursion))

}

async function updateExcursions() {
    console.log("\nUPDATING OR SAVING EXCURSIONS IN PARSE DB")
    return new Promise(async (resolve, reject) => {

        if (excursion.stopLoss != null || excursion.maePrice != null || excursion.mfePrice != null) {
            spinnerSetups.value = true
            //tradeSetupChanged.value = true
            const parseObject = Parse.Object.extend("excursions");
            const query = new Parse.Query(parseObject);
            query.equalTo("tradeId", tradeExcursionId.value)
            const results = await query.first();
            if (results) {
                console.log(" -> Updating excursions")
                spinnerSetupsText.value = "Updating"
                results.set("stopLoss", excursion.stopLoss == null || excursion.stopLoss == '' ? null : excursion.stopLoss)
                results.set("maePrice", excursion.maePrice == null || excursion.maePrice == '' ? null : excursion.maePrice)
                results.set("mfePrice", excursion.mfePrice == null || excursion.mfePrice == '' ? null : excursion.mfePrice)

                results.save()
                    .then(async () => {
                        console.log(' -> Updated excursions with id ' + results.id)
                        await useGetSelectedRange()
                        await useGetExcursions()
                        //spinnerSetupsText.value = "Updated setup"
                    }, (error) => {
                        console.log('Failed to create new object, with error code: ' + error.message);
                    })
            } else {
                console.log(" -> Saving excursions")
                spinnerSetupsText.value = "Saving"

                const object = new parseObject();
                object.set("user", Parse.User.current())
                object.set("stopLoss", excursion.stopLoss == null || excursion.stopLoss == '' ? null : excursion.stopLoss)
                object.set("maePrice", excursion.maePrice == null || excursion.maePrice == '' ? null : excursion.maePrice)
                object.set("mfePrice", excursion.mfePrice == null || excursion.mfePrice == '' ? null : excursion.mfePrice)

                object.set("dateUnix", tradeExcursionDateUnix.value)
                object.set("tradeId", tradeExcursionId.value)
                object.setACL(new Parse.ACL(Parse.User.current()));
                object.save()
                    .then(async (object) => {
                        console.log(' -> Added new excursion with id ' + object.id)
                        await useGetSelectedRange()
                        await useGetExcursions()
                        //spinnerSetupsText.value = "Added new setup"
                        tradeId.value = tradeExcursionId.value // we need to do this if I want to manipulate the current modal straight away, like for example delete after saving. WHen You push next or back, tradeId is set back to null
                    }, (error) => {
                        console.log('Failed to create new object, with error code: ' + error.message);
                    })
            }

        }
        resolve()


    })
}


/**************
 * MISC
 ***************/

function resetExcursion() {
    //console.log(" -> Resetting excursion")
    //we need to reset the setup variable each time
    for (let key in excursion) delete excursion[key]
    excursion.stopLoss = null
    excursion.maePrice = null
    excursion.mfePrice = null
}

/**************
 * TAGS
 ***************/


/**************
 * NOTES
 ***************/

const tradeNoteChange = (param) => {
    tradeNote.value = param
    //console.log(" -> New note " + tradeNote.value)
    tradeNoteDateUnix.value = filteredTrades[itemTradeIndex.value].dateUnix
    tradeNoteId.value = filteredTrades[itemTradeIndex.value].trades[tradeIndex.value].id
    //console.log(" tradeNoteId.value " + tradeNoteId.value)
    tradeNoteChanged.value = true
    saveButton.value = true

}

/**************
 * SCREENSHOTS
 ***************/
const existTradeScreenshots = (param1,param2) => {
    let exists = false
    for (let index = 0; index < param1.length; index++) {
        const el1 = param1[index];
        for (let index2 = 0; index2 < screenshots.length; index2++) {
            const el2 = screenshots[index2]
            if (el1.id.split("_")[0] == el2.name.split("_")[0] && index == param2) {
                exists = true
                break
            }
        }
    }
    return exists
}

const filteredTradeScreenshots = (param1,param2) => {
    //console.log(" filteredScreenshots")
    //if (param1) {
    //    console.log("param1"+JSON.stringify(param1))
    //}
    let screenshotArray = []
    let screenshotsArray = []
    screenshotsArray = screenshots
    
    for (let index = 0; index < param1.length; index++) {
        const el1 = param1[index];
        for (let index2 = 0; index2 < screenshotsArray.length; index2++) {
            const el2 = screenshotsArray[index2]
            if(el2.name)
            {
                if(el1.id.split("_")[0] == el2.name.split("_")[0]&& index==param2 && (screenshotArray.findIndex(obj => obj == el2) == -1)){
                    //console.log("push screenshot"+el1.id +"::" + el2.name)
                    screenshotArray.push(el2)
                }
            } else
            {
                //console.log("[DEBUG]: screenshotData el2 "+JSON.stringify(el2.name))
            }
        }
    }
    console.log(" -> Visualize trade screenshots" )
    return screenshotArray
}

const filteredScreenshots = (param1, param2) => {
    //console.log(" param1 dateUnix " + JSON.stringify(param1.dateUnix))
    //console.log(" filteredScreenshots")
    /*if (param1) {

        console.log(" param1 ")
    }
    if (param2) {
        console.log(" param2 ")
    }*/
    let screenshotArray = []
    //console.log(" screenshotsInfos "+JSON.stringify(screenshotsInfos))
    for (let index = 0; index < param1.trades.length; index++) {
        const el1 = param1.trades[index];
        let screenshotsArray = []
        if (param2) {
            screenshotsArray = screenshots
        } else {
            screenshotsArray = screenshotsInfos

        }
        for (let index2 = 0; index2 < screenshotsArray.length; index2++) {
            const el2 = screenshotsArray[index2]
            if (el2.name == el1.id && (screenshotArray.findIndex(obj => obj == el2) == -1)) {
                screenshotArray.push(el2)
            } else if (useStartOfDay(el2.dateUnix) == param1.dateUnix && (screenshotArray.findIndex(obj => obj == el2) == -1)) {
                screenshotArray.push(el2)
            }
        }

    }
    //console.log(" screenshotArray " + JSON.stringify(screenshotArray))
    return screenshotArray
}

const filterDiary = (param) => {
    //console.log(" filter diary ")
    return diaries.filter(obj => obj.dateUnix == param)
}


async function loadSavedPriceData(trade) {
    if (!trade || !trade.symbol || !trade.td) {
        return false
    }

    try {
        // Apply crosstrading logic: if enabled and symbol starts with M, strip it
        let querySymbol = trade.symbol
        if (crossTradingActive.value && trade.symbol.startsWith('M')) {
            querySymbol = trade.symbol.substring(1)
            console.log(` -> Crosstrading active: querying saved data for ${querySymbol} instead of ${trade.symbol}`)
        }

        const startUnix = dayjs(trade.td * 1000).tz(timeZoneTrade.value).startOf('day').valueOf()
        const endUnix = dayjs(trade.td * 1000).tz(timeZoneTrade.value).endOf('day').valueOf()
        const candles = await useGetPriceData(querySymbol, startUnix, endUnix, 10000, '1m')
        console.log(` -> Load candle data for ${candles.length} candles of ${querySymbol}`)

        if (!candles || candles.length === 0) {
            candlestickChartFailureMessage.value = 'No saved price data for ' + trade.symbol
            return false
        }

        const ohlcTimestamps = []
        const ohlcPrices = []
        const ohlcVolumes = []
        for (const candle of candles) {
            if (!Number.isFinite(candle.timestampUnix)) continue
            ohlcTimestamps.push(candle.timestampUnix)
            ohlcPrices.push([candle.close, candle.open, candle.low, candle.high])
            ohlcVolumes.push(Number.isFinite(candle.volume) ? candle.volume : 0)
        }

        if (ohlcTimestamps.length === 0) {
            candlestickChartFailureMessage.value = 'No valid OHLC timestamps found'
            return false
        }

        await useCandlestickChart(ohlcTimestamps, ohlcPrices, ohlcVolumes, trade, initCandleChart)
        initCandleChart = false
        ohlcArray.push({
            date: trade.td,
            symbol: trade.symbol,
            ohlcTimestamps,
            ohlcPrices,
            ohlcVolumes
        })
        candlestickChartFailureMessage.value = null
        return true
    } catch (error) {
        console.warn(' -> loadSavedPriceData failed', error)
        candlestickChartFailureMessage.value = 'Error loading price data: ' + (error.message || error)
        return false
    }
}


function getOHLC(date, symbol, type) {
    // Apply crosstrading logic: if enabled and symbol starts with M, strip it
    let apiSymbol = symbol
    if (crossTradingActive.value && symbol.startsWith('M')) {
        apiSymbol = symbol.substring(1)
        console.log(` -> Crosstrading active: using ${apiSymbol} instead of ${symbol}`)
    }

    if (apiSource.value === "databento") {
        console.log(" -> getting OHLC from " + apiSource.value + " for date " + useDateCalFormat(date))

        return new Promise(async (resolve, reject) => {
            let temp = {}
            temp.symbol = symbol

            let databentoSymbol = apiSymbol
            let stype_in = "raw_symbol"
            let toDate = dayjs(date * 1000).tz(timeZoneTrade.value).endOf('day').unix()
            let dataset
            //console.log("toDate "+toDate)
            temp.ohlcv = []

            if (type === "future") {
                dataset = "GLBX.MDP3"
                databentoSymbol = apiSymbol + ".c.0"
                stype_in = "continuous"

            } else if (type === "stock") {
                dataset = "XNAS.ITCH"

            } else if (tradedSymbols[i].secType === "call" || tradedSymbols[i].secType === "put") {

            } else if (tradedSymbols[i].secType === "forex") {

            }

            let data =
            {
                'dataset': dataset,
                'stype_in': stype_in,
                'symbols': databentoSymbol,
                'schema': 'ohlcv-1m',
                'start': date * 1000000000,
                'end': toDate * 1000000000,
                'encoding': 'csv',
                'pretty_px': 'true',
                'pretty_ts': 'true',
                'map_symbols': 'true',
                'username': apiKey.value
            }

            axios.post('/api/databento', data)
                .then(async (response) => {
                    //console.log(" response "+JSON.stringify(response.data))

                    let res = await useCreateOHLCV(response.data, temp)
                    ohlcv.push(res) // used for MFE calculation (same as in addTrades.js)

                    let tempArray = {}
                    tempArray.date = date
                    tempArray.symbol = symbol
                    tempArray.ohlcTimestamps = []
                    tempArray.ohlcPrices = []
                    tempArray.ohlcVolumes = []

                    for (let index = 0; index < res.ohlcv.length; index++) {
                        const element = res.ohlcv[index];

                        let temp = []

                        tempArray.ohlcTimestamps.push(element.t)
                        temp.push(element.c)
                        temp.push(element.o)
                        temp.push(element.l)
                        temp.push(element.h)
                        tempArray.ohlcPrices.push(temp)
                        tempArray.ohlcVolumes.push(element.v)
                    }

                    ohlcArray.push(tempArray)
                    //console.log("ohlcArray "+JSON.stringify(ohlcArray))
                    resolve()
                })
                .catch((error) => {
                    console.log(" -> Error in databento response " + error)
                    reject(error)
                });
        })

    }
    else if (apiSource.value === "polygon") {

        let ticker
        if (type === "put" || type === "call" || type === "option") {
            ticker = "O:" + apiSymbol
        } else if (type === "future") {
            ticker = "I:" + apiSymbol
        } else if (type === "forex") {
            ticker = "C:" + apiSymbol
        } else if (type === "crypto") {
            ticker = "X:" + apiSymbol
        } else {
            ticker = apiSymbol
        }
        console.log("  --> Getting OHLC for ticker " + ticker + " on " + date)

        return new Promise(async (resolve, reject) => {
            await axios.get("https://api.polygon.io/v2/aggs/ticker/" + ticker + "/range/1/minute/" + useDateCalFormat(date) + "/" + useDateCalFormat(date) + "?adjusted=true&sort=asc&limit=50000&apiKey=" + apiKey.value)

                .then((response) => {
                    let tempArray = {}
                    tempArray.date = date
                    tempArray.symbol = symbol
                    tempArray.ohlcTimestamps = []
                    tempArray.ohlcPrices = []
                    tempArray.ohlcVolumes = []

                    let temp = {}
                    temp.symbol = symbol
                    temp.ohlcv = response.data.results
                    ohlcv.push(temp) // used for MFE calculation (same as in addTrades.js)

                    for (let index = 0; index < response.data.results.length; index++) {
                        const element = response.data.results[index];

                        let temp = []

                        tempArray.ohlcTimestamps.push(element.t)
                        temp.push(element.c)
                        temp.push(element.o)
                        temp.push(element.l)
                        temp.push(element.h)
                        tempArray.ohlcPrices.push(temp)
                        tempArray.ohlcVolumes.push(element.v)
                    }

                    ohlcArray.push(tempArray)
                })
                .catch((error) => {
                    reject(error)
                })
                .finally(function () {
                    // always executed
                })

            resolve()

        })
    }

}
async function uploadOHLCFile(e, trade) {
    candlestickChartFailureMessage.value = null
    const file = e.target.files && e.target.files[0]
    if (!file) return
    console.log(" [uploadOHLCFile]-> Uploading OHLC CSV file: " + file.name)
    console.log(" [uploadOHLCFile]-> Current trade symbol from DB: " + trade.symbol)

    // ==========================================
    // 1. UNIVERSYLLES SYMBOL-MAPPING & CROSSTRADING
    // ==========================================
    let finalSymbol = trade.symbol ? trade.symbol.trim().toUpperCase() : ""

    // Wenn Crosstrading aktiv ist und es sich um ein Micro-Symbol handelt (beginnt mit 'M')
    if (crossTradingActive.value && finalSymbol.startsWith('M')) {
        const remainder = finalSymbol.substring(1)
        if (remainder.startsWith('ES') || remainder.startsWith('NQ') || remainder.startsWith('RTY') || remainder.startsWith('YM')) {
            finalSymbol = remainder
            console.log(` -> Crosstrading active (CSV): transformed Micro to Main symbol: ${finalSymbol}`)
        }
    }

    try {
        const text = await file.text()
        let temp = {}
        const ft = filteredTrades[itemTradeIndex.value]?.trades?.[tradeIndex.value]
        if (!ft) {
            throw new Error('No trade selected. Open the trade modal first.')
        }
        
        temp.symbol = finalSymbol
        temp.ohlcv = []

        // CSV-Zeilen aufteilen und leere Zeilen filtern
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)

        const ohlcTimestamps = []
        const ohlcPrices = []
        const ohlcVolumes = []

        // ==========================================
        // 2. EXAKTES PARSING IHRER TESTDATEN
        // ==========================================
        for (const line of lines) {
            // Erkennt automatisch Semikolon (wie in Ihren Daten) oder Komma
            const columns = line.includes(';') ? line.split(';') : line.split(',')
            if (columns.length < 5) continue 

            const rawTimestamp = columns[0]      // "2026-10-06 00:00:00"
            const openPrice = parseFloat(columns[1]) // 7380.00
            const highPrice = parseFloat(columns[2]) // 7386.00
            const lowPrice = parseFloat(columns[3])  // 7374.75
            const closePrice = parseFloat(columns[4])// 7377.00
            const volume = 0                         // Standardwert da nicht in CSV

            // Validierung der Zahlenwerte
            if (![openPrice, highPrice, lowPrice, closePrice].every(Number.isFinite)) {
                continue
            }

            // Datum-Parsing via Day.js für maximale Stabilität bei Zeitzonen
            const timestampMs = dayjs(rawTimestamp, 'YYYY-MM-DD HH:mm:ss').valueOf()
            if (!Number.isFinite(timestampMs)) {
                continue
            }

            ohlcTimestamps.push(timestampMs)
            // Format für useCandlestickChart: [Close, Open, Low, High]
            ohlcPrices.push([closePrice, openPrice, lowPrice, highPrice])
            ohlcVolumes.push(volume)

            // Format für die Parse-Datenbank (useSavePriceData)
            temp.ohlcv.push({
                t: timestampMs,
                o: openPrice,
                h: highPrice,
                l: lowPrice,
                c: closePrice,
                v: volume,
                utcOffset: dayjs(timestampMs).format('Z')
            })
        }

        if (ohlcTimestamps.length === 0) {
            throw new Error('No valid OHLC rows found in CSV')
        }

        // ==========================================
        // 3. SORTIERUNG DER DATEN (CHART & DB)
        // ==========================================
        const sortedRows = ohlcTimestamps.map((timestamp, index) => ({
            timestamp,
            price: ohlcPrices[index],
            volume: ohlcVolumes[index],
            ohlcv: temp.ohlcv[index]
        })).sort((a, b) => a.timestamp - b.timestamp)

        const sortedTimestamps = sortedRows.map(item => item.timestamp)
        const sortedPrices = sortedRows.map(item => item.price)
        const sortedVolumes = sortedRows.map(item => item.volume)
        temp.ohlcv = sortedRows.map(item => item.ohlcv)

        ohlcv.push(temp)
        
        // Chart mit korretem Symbolkontext rendern
        const chartTradeContext = { ...ft, symbol: temp.symbol }
        await useCandlestickChart(sortedTimestamps, sortedPrices, sortedVolumes, chartTradeContext, initCandleChart)
        initCandleChart = false
        candlestickChartFailureMessage.value = null

        // ==========================================
        // 4. DATENBANK-UPLOAD (UNTER ESM6 / NQZ6 ETC.)
        // ==========================================
        try {
            await useSavePriceData(temp.symbol, temp.ohlcv, {
                utcOffset: dayjs().format('Z'),
                timeframe: '1m',
                type: ft.type || 'future'
            })
            console.log(' [uploadOHLCFile]-> Successfully saved CSV price data in DB for:', temp.symbol)
        } catch (saveError) {
            console.warn(' [uploadOHLCFile]-> Failed to save CSV price data in DB:', saveError)
        }

    } catch (error) {
        console.error('Error loading OHLC CSV', error)
        candlestickChartFailureMessage.value = 'Error parsing CSV: ' + error.message
    }
}

async function uploadOHLCJsonFile(e, trade) {
    candlestickChartFailureMessage.value = null
    const file = e.target.files && e.target.files[0]
    if (!file) return
    console.log(" [uploadOHLCJson]-> Uploading OHLC JSON file: " + file.name)
    console.log(" [uploadOHLCJson]-> Current trade symbol from DB: " + trade.symbol)

    // ==========================================
    // 1. UNIVERSYLLES SYMBOL-MAPPING & CROSSTRADING
    // ==========================================
    let finalSymbol = trade.symbol ? trade.symbol.trim().toUpperCase() : ""

    // Wenn Crosstrading aktiv ist und es sich um ein Micro-Symbol handelt (beginnt mit 'M')
    // Beispiele: MESM6 -> ESM6, MNQU6 -> NQU6, MYMZ6 -> YMZ6
    if (crossTradingActive.value && finalSymbol.startsWith('M')) {
        // Wir prüfen, ob danach ein bekanntes Hauptsymbol folgt (MES->ES, MNQ->NQ, MRTY->RTY, MYM->YM)
        const remainder = finalSymbol.substring(1)
        if (remainder.startsWith('ES') || remainder.startsWith('NQ') || remainder.startsWith('RTY') || remainder.startsWith('YM')) {
            finalSymbol = remainder
            console.log(` [uploadOHLCJson]-> Crosstrading active: transformed Micro to Main symbol: ${finalSymbol}`)
        }
    }

    try {
        const text = await file.text()
        let jsonData
        try {
            jsonData = JSON.parse(text)
        } catch (parseError) {
            throw new Error('Invalid JSON format')
        }

        if (!jsonData || typeof jsonData !== 'object') {
            throw new Error('JSON root must be an object')
        }

        const ft = filteredTrades[itemTradeIndex.value]?.trades?.[tradeIndex.value]
        if (!ft) {
            throw new Error('No trade selected. Open the trade modal first.')
        }

        // ==========================================
        // 2. ABSICHERUNG: WARUM DER UPLOAD FEHLSCHLUG
        // ==========================================
        // Hier prüfen wir das Symbol aus dem JSON. 
        // Wenn es nur "ES", "MES", "NQ", "MNQ" etc. ist (Länge <= 3), extrahieren wir das echte Kontraktsymbol.
        let jsonSymbol = jsonData.symbol ? jsonData.symbol.trim().toUpperCase() : ""
        
        // Liste unvollständiger Basis-Symbole ohne Monats-/Jahreskennung
        const flatSymbols = ['ES', 'MES', 'NQ', 'MNQ', 'YM', 'MYM', 'RTY', 'MRTY']
        
        if (flatSymbols.includes(jsonSymbol) || !jsonSymbol) {
            console.log(` [uploadOHLCJson]-> JSON contained flat or empty symbol ('${jsonSymbol}'). Overriding with contract symbol: ${finalSymbol}`)
            jsonSymbol = finalSymbol // Überschreibt z.B. "ES" mit "ESM6"
        }

        const temp = {
            symbol: jsonSymbol, // Garantiert jetzt z.B. "ESM6" statt "ES"
            ohlcv: []
        }

        if (!Array.isArray(jsonData.data)) {
            throw new Error('JSON must contain a data array')
        }

        // ==========================================
        // 3. DATEN-PARSING (UNVERÄNDERT)
        // ==========================================
        const ohlcTimestamps = []
        const ohlcPrices = []
        const ohlcVolumes = []

        for (const row of jsonData.data) {
            if (!row || !row.date || !row.time) {
                continue
            }

            const normalizedDate = String(row.date).replace(/_/g, '-')
            const dateTimeStr = `${normalizedDate} ${row.time}`
            const timestampMs = dayjs(dateTimeStr, ['YYYY-MM-DD HH:mm:ss', 'YYYY-M-D HH:mm:ss'], true).valueOf()

            if (!Number.isFinite(timestampMs)) {
                continue
            }

            const openPrice = parseFloat(row.open)
            const highPrice = parseFloat(row.high)
            const lowPrice = parseFloat(row.low)
            const closePrice = parseFloat(row.close)
            const volume = Number.isFinite(parseFloat(row.volume)) ? parseFloat(row.volume) : 0

            if (![openPrice, highPrice, lowPrice, closePrice].every(Number.isFinite)) {
                continue
            }

            ohlcTimestamps.push(timestampMs)
            ohlcPrices.push([closePrice, openPrice, lowPrice, highPrice])
            ohlcVolumes.push(volume)
        }

        if (ohlcTimestamps.length === 0) {
            throw new Error('No valid OHLC rows found in JSON')
        }

        // WICHTIG: Befüllen von temp.ohlcv passend zu den bereinigten Daten
        for (let i = 0; i < ohlcTimestamps.length; i++) {
            temp.ohlcv.push({
                t: ohlcTimestamps[i],
                o: ohlcPrices[i][1],
                h: ohlcPrices[i][3],
                l: ohlcPrices[i][2],
                c: ohlcPrices[i][0],
                v: ohlcVolumes[i],
                utcOffset: dayjs(ohlcTimestamps[i]).format('Z')
            })
        }

        const sortedRows = ohlcTimestamps.map((timestamp, index) => ({
            timestamp,
            price: ohlcPrices[index],
            volume: ohlcVolumes[index],
            ohlcv: temp.ohlcv[index]
        })).sort((a, b) => a.timestamp - b.timestamp)

        const sortedTimestamps = sortedRows.map(item => item.timestamp)
        const sortedPrices = sortedRows.map(item => item.price)
        const sortedVolumes = sortedRows.map(item => item.volume)
        temp.ohlcv = sortedRows.map(item => item.ohlcv)

        ohlcv.push(temp)
        
        // Kontext für den Chart mit dem korrekten Symbol übergeben
        const chartTradeContext = { ...ft, symbol: temp.symbol }
        await useCandlestickChart(sortedTimestamps, sortedPrices, sortedVolumes, chartTradeContext, initCandleChart)
        initCandleChart = false
        candlestickChartFailureMessage.value = null

        // ==========================================
        // 4. FIX FÜR DEN DATENBANK-UPLOAD
        // ==========================================
        try {
            // Übergibt jetzt exakt "ESM6" oder "NQU6" an Ihre Parse-Schnittstelle
            await useSavePriceData(temp.symbol, temp.ohlcv, {
                utcOffset: dayjs().format('Z'),
                timeframe: '1m',
                type: ft.type || 'future'
            })
            console.log(' [uploadOHLCJson]-> Successfully saved price data in DB for:', temp.symbol)
        } catch (saveError) {
            console.warn(' [uploadOHLCJson]-> Failed to save price data in DB:', saveError)
        }
    } catch (error) {
        console.error('Error loading OHLC JSON', error)
        candlestickChartFailureMessage.value = 'Error parsing JSON: ' + error.message
    }
}


async function showLocalOHLC() {
    try {
        const ft = filteredTrades[itemTradeIndex.value].trades[tradeIndex.value]
        const ok = await loadLocalOHLCFromProject(ft)
        if (!ok) {
            candlestickChartFailureMessage.value = 'Local OHLC not found in /data/'
        } else {
            candlestickChartFailureMessage.value = null
        }
    } catch (e) {
        console.error(e)
        candlestickChartFailureMessage.value = 'Error loading local OHLC: ' + e.message
    }
}
//ToDo Cleanup specific stuff
async function loadLocalOHLCFromProject(trade) {
    const candidates = [
        `testdata_18_5.csv`,
        `${trade.symbol}_${dayjs(trade.td * 1000).format('YYYY_MM_DD')}.csv`,
        `${dayjs(trade.td * 1000).format('YYYY_MM_DD')}.csv`,
        `${trade.symbol}.csv`
    ]

    for (const fileName of candidates) {
        try {
            const response = await axios.get(`/api/local-ohlc/${encodeURIComponent(fileName)}`)
            if (!response.data) continue
            const temp = { symbol: trade.symbol, ohlcv: [] }
            const res = await useCreateOHLCV(response.data, temp)
            ohlcv.push(res)

            const ohlcTimestamps = []
            const ohlcPrices = []
            const ohlcVolumes = []
            for (let i = 0; i < res.ohlcv.length; i++) {
                const element = res.ohlcv[i]
                ohlcTimestamps.push(element.t)
                ohlcPrices.push([element.c, element.o, element.l, element.h])
                ohlcVolumes.push(element.v)
            }
            await useCandlestickChart(ohlcTimestamps, ohlcPrices, ohlcVolumes, trade, initCandleChart)
            initCandleChart = false
            return true
        } catch (error) {
            if (error.response && error.response.status === 404) {
                continue
            }
            console.warn('Local OHLC load failed for', fileName, error)
            continue
        }
    }
    return false
}

</script>

<template>
    <SpinnerLoadingPage />
    <div v-if="!spinnerLoadingPage && filteredTrades" class="row mt-2 mb-2">
        <Filters />
        <div v-if="!hasData">
            <NoData />
        </div>
        <div v-show="hasData">
            <!-- added v-if instead v-show because need to wait for patterns to load -->
            <div class="row">
                <!-- ============ CARD ============ -->
                <div class="col-12 col-xl-8">
                    <!-- v-show insead of v-if or else init tab does not work cause div is not created until spinner is false-->
                    <div v-for="(itemTrade, index) in filteredTrades" class="row mt-2">
                        <div class="col-12">
                            <div class="dailyCard">
                                <div class="row">
                                    <!-- ============ PART 1 ============ -->
                                    <!-- Line 1 : Date and P&L -->
                                    <!--<input id="providers" type="text" class="form-control" placeholder="Fournisseur*" autocomplete="off"/>-->


                                    <div class="col-12 cardFirstLine mb-2">
                                        <div class="row">
                                            <div class="col-12 col-lg-auto">{{ useCreatedDateFormat(itemTrade.dateUnix)
                                                }}
                                                <i v-on:click="useDailySatisfactionChange(itemTrade.dateUnix, true, itemTrade)"
                                                    v-bind:class="[itemTrade.satisfaction == true ? 'greenTrade' : '', 'uil', 'uil-thumbs-up', 'ms-2', 'me-1', 'pointerClass']"></i>
                                                <i v-on:click="useDailySatisfactionChange(itemTrade.dateUnix, false, itemTrade)"
                                                    v-bind:class="[itemTrade.satisfaction == false ? 'redTrade' : '', , 'uil', 'uil-thumbs-down', 'pointerClass']"></i>

                                                <i v-show="tags.filter(obj => obj.tradeId == itemTrade.dateUnix.toString()).length == 0 || (tags.filter(obj => obj.tradeId == itemTrade.dateUnix.toString()).length > 0 && tags.filter(obj => obj.tradeId == itemTrade.dateUnix.toString())[0].tags.length === 0)"
                                                    data-bs-toggle="modal" data-bs-target="#tagsModal"
                                                    :data-index="index" class="ms-2 uil uil-tag-alt pointerClass"></i>

                                            </div>
                                            <div class="col-12 col-lg-auto ms-auto">P&L({{ selectedGrossNet.charAt(0)
                                                }}):
                                                <span
                                                    v-bind:class="[itemTrade.pAndL[amountCase + 'Proceeds'] > 0 ? 'greenTrade' : 'redTrade']">{{
                                                        useTwoDecCurrencyFormat(itemTrade.pAndL[amountCase + 'Proceeds'])
                                                    }}</span>
                                            </div>

                                        </div>
                                        <div>
                                            <span
                                                v-for="tags in tags.filter(obj => obj.tradeId == itemTrade.dateUnix.toString())">
                                                <span v-for="tag in tags.tags.slice(0, 7)"
                                                    class="tag txt-small pointerClass"
                                                    :style="{ 'background-color': useGetTagInfo(tag).groupColor }"
                                                    data-bs-toggle="modal" data-bs-target="#tagsModal"
                                                    :data-index="index">{{
                                                        useGetTagInfo(tag).tagName
                                                    }}
                                                </span>
                                                <span v-show="tags.tags.length > 7">+{{
                                                    tags.tags.length
                                                    - 7 }}</span>
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Line 2 : Charts and total data -->
                                    <div class="col-12 d-flex align-items-center text-center">
                                        <div class="row">

                                            <!--  -> Win Loss Chart -->
                                            <div class="col-12 col-lg-6">
                                                <div class="row">
                                                    <div class="col-4">
                                                        <div v-bind:id="'pieChart' + itemTrade.dateUnix"
                                                            class="chartIdDailyClass">
                                                        </div>
                                                    </div>
                                                    <!--  -> Win Loss evolution Chart -->
                                                    <div class="col-8 chartCard">
                                                        <div v-bind:id="'doubleLineChart' + itemTrade.dateUnix"
                                                            class="chartIdDailyClass"></div>
                                                    </div>
                                                </div>
                                            </div>

                                            <!--  -> Tot trades and total executions -->
                                            <div class="col-12 col-lg-6">
                                                <div class="row">
                                                    <div class="col row">
                                                        <div>
                                                            <label>Executions</label>
                                                            <p>{{ itemTrade.pAndL.executions }}</p>
                                                        </div>
                                                        <div>
                                                            <label>Trades</label>
                                                            <p>{{ itemTrade.pAndL.trades }}</p>
                                                        </div>
                                                    </div>

                                                    <!--  -> Tot Wins and losses -->
                                                    <div class="col row">
                                                        <div>
                                                            <label>Wins</label>
                                                            <p>{{ itemTrade.pAndL.grossWinsCount }}</p>
                                                        </div>
                                                        <div>
                                                            <label>Losses</label>
                                                            <p>{{ itemTrade.pAndL.grossLossCount }}</p>
                                                        </div>
                                                    </div>

                                                    <!--  -> Tot commission and gross p&l -->
                                                    <div class="col row">
                                                        <div>
                                                            <label>Tot Fees</label>
                                                            <p>{{ useTwoDecCurrencyFormat(itemTrade.pAndL.fees) }}</p>
                                                        </div>
                                                        <div>
                                                            <label>P&L(g)</label>
                                                            <p>{{ useTwoDecCurrencyFormat(itemTrade.pAndL.grossProceeds)
                                                                }}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- end PART 1 -->

                                    <!-- ============ PART 2 ============ -->
                                    <div v-if="!modalDailyTradeOpen" class="col-12 table-responsive">
                                        <nav>
                                            <!--------------------
                                            TABS
                                            --------------------->

                                            <!--Trades-->
                                            <div class="nav nav-tabs mb-2" id="nav-tab" role="tablist">
                                                <button class="nav-link" v-bind:id="'trades-' + index"
                                                    data-bs-toggle="tab" v-bind:data-bs-target="'#tradesNav-' + index"
                                                    type="button" role="tab" aria-controls="nav-overview"
                                                    aria-selected="true">Trades
                                                </button>

                                                <!--Blotter-->
                                                <button class="nav-link" v-bind:id="'blotter-' + index"
                                                    data-bs-toggle="tab" v-bind:data-bs-target="'#blotterNav-' + index"
                                                    type="button" role="tab" aria-controls="nav-overview"
                                                    aria-selected="true">Blotter
                                                </button>

                                                <!--Screenshots-->
                                                <button v-bind:id="'screenshots-' + index" data-bs-toggle="tab"
                                                    v-bind:data-bs-target="'#screenshotsNav-' + index" type="button"
                                                    role="tab" aria-controls="nav-overview" aria-selected="true"
                                                    v-bind:class="[filteredScreenshots(itemTrade).length > 0 ? '' : 'noDataTab', 'nav-link']">Screenshots<span
                                                        v-if="filteredScreenshots(itemTrade).length > 0"
                                                        class="txt-small">
                                                        ({{ filteredScreenshots(itemTrade).length }})</span>
                                                </button>

                                                <!--Diary-->
                                                <button v-bind:id="'diaries-' + index" data-bs-toggle="tab"
                                                    v-bind:data-bs-target="'#diariesNav-' + index" type="button"
                                                    role="tab" aria-controls="nav-overview" aria-selected="true"
                                                    v-bind:class="[filterDiary(itemTrade.dateUnix).length > 0 ? '' : 'noDataTab', 'nav-link']">Diary
                                                </button>
                                            </div>
                                        </nav>
                                        <div class="tab-content" id="nav-tabContent">

                                            <!-- TRADES TAB -->
                                            <div class="tab-pane fade txt-small" v-bind:id="'tradesNav-' + index"
                                                role="tabpanel" aria-labelledby="nav-overview-tab">
                                                <table class="table">
                                                    <thead>
                                                        <tr>
                                                            <th scope="col">Symbol</th>
                                                            <th scope="col">Vol<i class="ps-1 uil uil-info-circle"
                                                                    data-bs-toggle="tooltip"
                                                                    data-bs-title="Total number of securities during the trade (bought + sold or shorted + covered)"></i>
                                                            </th>
                                                            <th scope="col">Position</th>
                                                            <th scope="col">Entry</th>
                                                            <th scope="col">P&L/Sec<i class="ps-1 uil uil-info-circle"
                                                                    data-bs-toggle="tooltip"
                                                                    data-bs-title="Profit&Loss per unit of security traded (baught or shorted)"></i>
                                                            </th>
                                                            <th scope="col">P&L(n)</th>
                                                            <th scope="col">Tags</th>
                                                            <th scope="col">Note</th>
                                                            <th scope="col"></th>
                                                            <th scope="col"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>

                                                        <!-- the page loads faster than the video blob => check if blob, that is after slash, is not null, and then load -->
                                                        <!--<tr v-if="/[^/]*$/.exec(videoBlob)[0]!='null'&&trade.videoStart&&trade.videoEnd">-->

                                                        <tr v-for="(trade, index2) in itemTrade.trades"
                                                            data-bs-toggle="modal" data-bs-target="#tradesModal"
                                                            class="pointerClass" :data-index="index"
                                                            :data-indextwo="index2">

                                                            <!--Symbol-->


                                                            <td>{{ trade.symbol }}</td>

                                                            <!--Vol-->
                                                            <td>{{ trade.buyQuantity + trade.sellQuantity }}</td>

                                                            <!--Position-->
                                                            <td>
                                                                {{
                                                                    trade.strategy.charAt(0).toUpperCase() +
                                                                    trade.strategy.slice(1)
                                                                }}
                                                            </td>

                                                            <!--Entry-->
                                                            <td>
                                                                <span v-if="trade.tradesCount == 0"><span
                                                                        v-if="trade.openPosition">Open<i
                                                                            class="ps-1 uil uil-info-circle"
                                                                            data-bs-toggle="tooltip" data-bs-html="true"
                                                                            v-bind:data-bs-title="'Swing trade opened on ' + useDateCalFormat(trade.entryTime)"></i></span><span
                                                                        v-else>Closed<i class="ps-1 uil uil-info-circle"
                                                                            data-bs-toggle="tooltip" data-bs-html="true"
                                                                            v-bind:data-bs-title="'Swing trade closed on ' + useDateCalFormat(trade.exitTime)"></i></span></span><span
                                                                    v-else>{{ useTimeFormat(trade.entryTime) }}<span
                                                                        v-if="checkDate(trade.td, trade.entryTime) == false"><i
                                                                            class="ps-1 uil uil-info-circle"
                                                                            data-bs-toggle="tooltip" data-bs-html="true"
                                                                            v-bind:data-bs-title="'Swing trade from ' + useDateCalFormat(trade.entryTime)"></i></span></span>
                                                            </td>

                                                            <!--P&L/Vol-->
                                                            <td>
                                                                <span v-if="trade.tradesCount == 0"></span><span
                                                                    v-else-if="trade.type == 'forex'">-</span><span
                                                                    v-else
                                                                    v-bind:class="[trade.grossSharePL > 0 ? 'greenTrade' : 'redTrade']">{{
                                                                        useTwoDecCurrencyFormat(trade.grossSharePL)
                                                                    }}</span>
                                                            </td>

                                                            <!--P&L-->
                                                            <td>
                                                                <span v-if="trade.tradesCount == 0"></span><span v-else
                                                                    v-bind:class="[trade.netProceeds > 0 ? 'greenTrade' : 'redTrade']">
                                                                    {{ useTwoDecCurrencyFormat(trade.netProceeds)
                                                                    }}</span>
                                                            </td>

                                                            <!--TAGS -->
                                                            <td>
                                                                <span
                                                                    v-for="tags in tags.filter(obj => obj.tradeId == trade.id)">
                                                                    <span v-for="tag in tags.tags.slice(0, 2)"
                                                                        class="tag txt-small"
                                                                        :style="{ 'background-color': useGetTagInfo(tag).groupColor }">{{
                                                                            useGetTagInfo(tag).tagName }}
                                                                    </span>
                                                                    <span v-show="tags.tags.length > 2">+{{
                                                                        tags.tags.length
                                                                        - 2 }}</span>
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span
                                                                    v-for="note in notes.filter(obj => obj.tradeId == trade.id)">
                                                                    <span v-if="note.note.length > 12">{{
                                                                        note.note.substring(0, 12) }}...</span><span
                                                                        v-else>{{ note.note }}</span>
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span v-if="trade.satisfaction == true">
                                                                    <i class="greenTrade uil uil-thumbs-up"></i>
                                                                </span>
                                                                <span v-if="trade.satisfaction == false">
                                                                    <i class="redTrade uil uil-thumbs-down"></i>
                                                                </span>
                                                            </td>

                                                            <td>
                                                                <span
                                                                    v-if="screenshotsInfos.findIndex(f => f.name == trade.id) != -1">
                                                                    <i class="uil uil-image-v"></i>
                                                                </span>
                                                            </td>

                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>

                                            <!-- BLOTTER TAB -->
                                            <div class="tab-pane fade txt-small" v-bind:id="'blotterNav-' + index"
                                                role="tabpanel" aria-labelledby="nav-overview-tab">
                                                <table v-bind:id="'table' + index" class="table">
                                                    <thead>
                                                        <tr>
                                                            <th scope="col">Symbol</th>
                                                            <th scope="col">Vol</th>
                                                            <th scope="col">P&L(g)</th>
                                                            <th scope="col">Tot Fees</th>
                                                            <th scope="col">P&L(n)</th>
                                                            <th scope="col">Wins</th>
                                                            <th scope="col">Losses</th>
                                                            <th scope="col">Trades</th>
                                                            <th scope="col">Executions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr v-for="blot in itemTrade.blotter">

                                                            <td>{{ blot.symbol }}</td>
                                                            <td>{{ useDecimalsArithmetic(blot.buyQuantity,
                                                                blot.sellQuantity) }}</td>
                                                            <td
                                                                v-bind:class="[blot.grossProceeds > 0 ? 'greenTrade' : 'redTrade']">
                                                                {{ useTwoDecCurrencyFormat(blot.grossProceeds) }}</td>
                                                            <td>{{ useTwoDecCurrencyFormat(blot.fees) }}</td>
                                                            <td
                                                                v-bind:class="[blot[amountCase + 'Proceeds'] > 0 ? 'greenTrade' : 'redTrade']">
                                                                {{ useTwoDecCurrencyFormat(blot.netProceeds) }}</td>
                                                            <td>{{ blot.grossWinsCount }}</td>
                                                            <td>{{ blot.grossLossCount }}</td>
                                                            <td>{{ blot.trades }}</td>
                                                            <td>{{ blot.executions }}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>

                                            <!-- SCREENSHOTS TAB -->
                                            <div class="tab-pane fade txt-small" v-bind:id="'screenshotsNav-' + index"
                                                role="tabpanel" aria-labelledby="nav-overview-tab">
                                                <div v-show="idCurrentType == 'screenshots' && idCurrentNumber == index && tabGettingScreenshots"
                                                    class="text-center spinnerHeigth">
                                                    <div class="spinner-border text-blue" role="status"></div>
                                                </div>
                                                <div v-if="filteredScreenshots(itemTrade).length > 0 && idCurrentType == 'screenshots' && idCurrentNumber == index"
                                                    v-for="itemScreenshot in filteredScreenshots(itemTrade, itemTrade.dateUnix)">
                                                    <span class="mb-2">
                                                        <Screenshot :screenshot-data="itemScreenshot" show-title
                                                            source="dailyTab" />
                                                    </span>
                                                </div>
                                            </div>

                                            <!-- DIARY TAB -->
                                            <div class="tab-pane fade" v-bind:id="'diariesNav-' + index" role="tabpanel"
                                                aria-labelledby="nav-overview-tab">
                                                <div
                                                    v-for="itemDiary in diaries.filter(obj => obj.dateUnix == itemTrade.dateUnix)">
                                                    <p v-html="itemDiary.diary"></p>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                    <!-- end PART 2 -->

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- end card-->
                <!-- ============ CALENDAR ============ -->
                <div v-show="calendarData && !spinnerLoadingPage"
                    class="col-12 col-xl-4 text-center mt-2 align-self-start">
                    <div class="dailyCard calCard">
                        <div class="row">
                            <Calendar />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Load more spinner -->
            <div v-if="spinnerLoadMore" class="d-flex justify-content-center mt-3">
                <div class="spinner-border text-blue" role="status"></div>
            </div>

        </div>
    </div>

    <!-- ============ TRADES MODAL ============ -->
    <div class="modal fade" id="tradesModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1"
        aria-labelledby="exampleModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl">
            <div class="modal-content">
                <div v-if="modalDailyTradeOpen">
                    <div v-if="screenshot.originalBase64">
                        <Screenshot :screenshot-data="screenshot" source="dailyModal" />
                    </div>
                    <div v-show="!candlestickChartFailureMessage && !screenshot.originalBase64" id="candlestickChart"
                        class="candlestickClass">
                    </div>
                    <div class="mt-2 text-center">
                        <label class="form-label small">Upload OHLC CSV or JSON</label>
                        <div class="row g-2 justify-content-center">
                            <div class="col-auto">
                                <input type="file" accept=".csv" class="form-control form-control-sm" v-on:change="uploadOHLCFile($event,filteredTrades[itemTradeIndex].trades[tradeIndex])" />
                            </div>
                            <div class="col-auto">
                                <input type="file" accept=".json" class="form-control form-control-sm" v-on:change="uploadOHLCJsonFile($event,filteredTrades[itemTradeIndex].trades[tradeIndex])" />
                            </div>
                            <div class="col-auto d-flex align-items-center">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" id="crossTradingToggle" v-model="crossTradingActive" />
                                    <label class="form-check-label small" for="crossTradingToggle">Crosstrading active</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="container mt-2 text-center" v-show="candlestickChartFailureMessage">{{
                        candlestickChartFailureMessage }}</div>

                    <!-- *** Table *** -->
                    <div class="mt-3 table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th scope="col">Symbol</th>
                                    <th scope="col">Vol</th>
                                    <th scope="col">Position</th>
                                    <th scope="col">Entry</th>
                                    <th scope="col">Price</th>
                                    <th scope="col">Exit</th>
                                    <th scope="col">Price</th>
                                    <th scope="col">Duration</th>
                                    <th scope="col">P&L/Vol</th>
                                    <th scope="col">P/L(n)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- the page loads faster than the video blob => check if blob, that is after slash, is not null, and then load -->
                                <tr>
                                    <td>{{ filteredTrades[itemTradeIndex].trades[tradeIndex].symbol }}</td>
                                    <td>{{ filteredTrades[itemTradeIndex].trades[tradeIndex].buyQuantity +
                                        filteredTrades[itemTradeIndex].trades[tradeIndex].sellQuantity }}
                                    </td>
                                    <td>{{ filteredTrades[itemTradeIndex].trades[tradeIndex].side == 'B' ? 'Long' :
                                        'Short'
                                        }}</td>

                                    <td>
                                        <span
                                            v-if="filteredTrades[itemTradeIndex].trades[tradeIndex].tradesCount == 0"><span
                                                v-if="filteredTrades[itemTradeIndex].trades[tradeIndex].openPosition">Open<i
                                                    class="ps-1 uil uil-info-circle" data-bs-toggle="tooltip"
                                                    data-bs-html="true"
                                                    v-bind:data-bs-title="'Swing trade opened on ' + useDateCalFormat(filteredTrades[itemTradeIndex].trades[tradeIndex].entryTime)"></i></span><span
                                                v-else>Closed<i class="ps-1 uil uil-info-circle"
                                                    data-bs-toggle="tooltip" data-bs-html="true"
                                                    v-bind:data-bs-title="'Swing trade closed on ' + useDateCalFormat(filteredTrades[itemTradeIndex].trades[tradeIndex].exitTime)"></i></span></span><span
                                            v-else>{{
                                                useTimeFormat(filteredTrades[itemTradeIndex].trades[tradeIndex].entryTime)
                                            }}<span
                                                v-if="checkDate(filteredTrades[itemTradeIndex].trades[tradeIndex].td, filteredTrades[itemTradeIndex].trades[tradeIndex].entryTime) == false"><i
                                                    class="ps-1 uil uil-info-circle" data-bs-toggle="tooltip"
                                                    data-bs-html="true"
                                                    v-bind:data-bs-title="'Swing trade from ' + useDateCalFormat(filteredTrades[itemTradeIndex].trades[tradeIndex].entryTime)"></i></span></span>
                                    </td>

                                    <!--Entry Price-->
                                    <td><span
                                            v-if="filteredTrades[itemTradeIndex].trades[tradeIndex].tradesCount == 0"></span><span
                                            v-else-if="filteredTrades[itemTradeIndex].trades[tradeIndex].type == 'forex'">{{
                                                (filteredTrades[itemTradeIndex].trades[tradeIndex].entryPrice).toFixed(5)
                                            }}</span><span v-else>{{
                                                useTwoDecCurrencyFormat(filteredTrades[itemTradeIndex].trades[tradeIndex].entryPrice)
                                            }}<span
                                                v-if="checkDate(filteredTrades[itemTradeIndex].trades[tradeIndex].td, filteredTrades[itemTradeIndex].trades[tradeIndex].entryTime) == false"><i
                                                    class="ps-1 uil uil-info-circle" data-bs-toggle="tooltip"
                                                    data-bs-html="true"
                                                    v-bind:data-bs-title="'Swing trade from ' + useDateCalFormat(filteredTrades[itemTradeIndex].trades[tradeIndex].entryTime)"></i></span></span>
                                    </td>

                                    <!--Exit-->
                                    <td><span
                                            v-if="filteredTrades[itemTradeIndex].trades[tradeIndex].tradesCount == 0"></span><span
                                            v-else>{{
                                                useTimeFormat(filteredTrades[itemTradeIndex].trades[tradeIndex].exitTime)
                                            }}</span></td>


                                    <!--Exit Price-->
                                    <td><span
                                            v-if="filteredTrades[itemTradeIndex].trades[tradeIndex].tradesCount == 0"></span><span
                                            v-else-if="filteredTrades[itemTradeIndex].trades[tradeIndex].type == 'forex'">{{
                                                (filteredTrades[itemTradeIndex].trades[tradeIndex].exitPrice).toFixed(5)
                                            }}</span><span v-else>{{
                                                useTwoDecCurrencyFormat(filteredTrades[itemTradeIndex].trades[tradeIndex].exitPrice)
                                            }}</span></td>

                                    <!--Duration-->
                                    <td><span
                                            v-if="filteredTrades[itemTradeIndex].trades[tradeIndex].tradesCount == 0"></span><span
                                            v-else><span
                                                v-if="checkDate(filteredTrades[itemTradeIndex].trades[tradeIndex].td, filteredTrades[itemTradeIndex].trades[tradeIndex].entryTime) == false">{{
                                                    useSwingDuration(filteredTrades[itemTradeIndex].trades[tradeIndex].exitTime
                                                        -
                                                        filteredTrades[itemTradeIndex].trades[tradeIndex].entryTime)
                                                }}</span><span v-else>{{
                                                    useTimeDuration(filteredTrades[itemTradeIndex].trades[tradeIndex].exitTime
                                                        -
                                                        filteredTrades[itemTradeIndex].trades[tradeIndex].entryTime)
                                                }}</span></span>
                                    </td>

                                    <!--P&L/Vol-->
                                    <td>
                                        <span
                                            v-if="filteredTrades[itemTradeIndex].trades[tradeIndex].tradesCount == 0"></span><span
                                            v-else-if="filteredTrades[itemTradeIndex].trades[tradeIndex].type == 'forex'"></span><span
                                            v-else
                                            v-bind:class="[(filteredTrades[itemTradeIndex].trades[tradeIndex].grossSharePL) > 0 ? 'greenTrade' : 'redTrade']">{{
                                                useTwoDecCurrencyFormat(filteredTrades[itemTradeIndex].trades[tradeIndex].grossSharePL)
                                            }}</span>
                                    </td>

                                    <!--P&L-->
                                    <td><span
                                            v-if="filteredTrades[itemTradeIndex].trades[tradeIndex].tradesCount == 0"></span><span
                                            v-else
                                            v-bind:class="[filteredTrades[itemTradeIndex].trades[tradeIndex].netProceeds > 0 ? 'greenTrade' : 'redTrade']">
                                            {{
                                                useTwoDecCurrencyFormat(filteredTrades[itemTradeIndex].trades[tradeIndex].netProceeds)
                                            }}</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- *** VARIABLES *** -->
                    <div class="mt-1 mb-2 row align-items-center ms-1 me-1 tradeSetup">
                        <div class="col-12">
                            <div class="row">
                                <!-- First line -->
                                <div class="col-12" v-show="!spinnerSetups">
                                    <div class="row align-items-center">

                                        <!-- Satisfaction -->
                                        <div class="col-1">
                                            <i v-on:click="tradeSatisfactionChange(filteredTrades[itemTradeIndex].trades[tradeIndex], true)"
                                                v-bind:class="[filteredTrades[itemTradeIndex].trades[tradeIndex].satisfaction == true ? 'greenTrade' : '', 'uil', 'uil-thumbs-up', 'pointerClass', 'me-1']"></i>

                                            <i v-on:click="tradeSatisfactionChange(filteredTrades[itemTradeIndex].trades[tradeIndex], false)"
                                                v-bind:class="[filteredTrades[itemTradeIndex].trades[tradeIndex].satisfaction == false ? 'redTrade' : '', 'uil', 'uil-thumbs-down', 'pointerClass']"></i>
                                        </div>


                                        <!-- Tags -->
                                        <div class="container-tags col-8">
                                            <div class="form-control dropdown form-select" style="height: auto;">
                                                <div style="display: flex; align-items: center; flex-wrap: wrap;">
                                                    <span v-for="(tag, index) in tradeTags" :key="index"
                                                        class="tag txt-small"
                                                        :style="{ 'background-color': useGetTagInfo(tag.id).groupColor }"
                                                        @click="useTradeTagsChange('remove', index)">
                                                        {{ tag.name }}<span class="remove-tag">×</span>
                                                    </span>

                                                    <input type="text" v-model="tagInput" @input="useFilterTags"
                                                        @keydown.enter.prevent="useTradeTagsChange('add', tagInput)"
                                                        @keydown.tab.prevent="useTradeTagsChange('add', tagInput)"
                                                        class="form-control tag-input" placeholder="Add a tag">
                                                    <div class="clickable-area" v-on:click="useToggleTagsDropdown">
                                                    </div>
                                                </div>
                                            </div>

                                            <ul id="dropdown-menu-tags" class="dropdown-menu-tags"
                                                :style="[!showTagsList ? 'border: none;' : '']">
                                                <span v-show="showTagsList" v-for="group in availableTags">
                                                    <h6 class="p-1 mb-0"
                                                        :style="'background-color: ' + group.color + ';'"
                                                        v-show="useFilterSuggestions(group.id).filter(obj => obj.id == group.id)[0].tags.length > 0">
                                                        {{ group.name }}</h6>
                                                    <li v-for="(suggestion, index) in useFilterSuggestions(group.id).filter(obj => obj.id == group.id)[0].tags"
                                                        :key="index" :class="{ active: index === selectedTagIndex }"
                                                        @click="useTradeTagsChange('addFromDropdownMenu', suggestion)"
                                                        class="dropdown-item dropdown-item-tags">
                                                        <span class="ms-2">{{ suggestion.name }}</span>
                                                    </li>
                                                </span>
                                            </ul>
                                        </div>
                                        <!-- MFE -->
                                        <div class="col-3">
                                            <input type="number" class="form-control" placeholder="MFE Price"
                                                        style="font-size: small;" v-bind:value="excursion.mfePrice"
                                                        v-on:click="tradeExcursionClicked"
                                                        v-on:change="tradeExcursionChange($event.target.value, 'mfePrice')">
                                        </div>
                                        <!-- Delete
                                        <div class="col-1">
                                            <i v-on:click="useDeleteSetup(filteredTrades[itemTradeIndex].dateUnix, filteredTrades[itemTradeIndex].trades[tradeIndex])"
                                                class="ps-2 uil uil-trash-alt pointerClass"></i>
                                        </div> -->
                                    </div>
                                </div>

                                <!-- Second line -->
                                <div class="col-12 mt-2" v-show="!spinnerSetups">
                                    <textarea class="form-control" placeholder="note" id="floatingTextarea"
                                        v-bind:value="tradeNote"
                                        @input="tradeNoteChange($event.target.value)"></textarea>
                                </div>
                                <!-- Third line -->

                                <!-- Single screenshot from database -->
                                <div class="col-12 mt-2" v-show="!spinnerSetups">
                                    <!-- Screenshot section -->
                                    <div class="txt-small">
                                        <!-- Visualisation of screenshots -->
                                        <div v-if="existTradeScreenshots(filteredTrades[itemTradeIndex].trades,tradeIndex)">
                                            <div v-for="itemScreenshot in filteredTradeScreenshots(filteredTrades[itemTradeIndex].trades,tradeIndex)" 
                                                :key="itemScreenshot.id" 
                                                class="mb-2">
                                                <Screenshot 
                                                :screenshot-data="itemScreenshot" 
                                                show-title
                                                source="dailyTab" />
                                            </div>
                                        </div>
                                    </div>
                                </div>


                                <!-- Forth line -->
                                <div class="col-12 mt-3" v-show="!spinnerSetups">
                                    <input class="screenshotFile" type="file"
                                        @change="useSetupImageUpload($event, filteredTrades[itemTradeIndex].trades[tradeIndex].entryTime, filteredTrades[itemTradeIndex].trades[tradeIndex].symbol, filteredTrades[itemTradeIndex].trades[tradeIndex].side)" />
                                </div>


                                <!-- Fifth line -->
                                <div class="col-12 mt-3" v-show="!spinnerSetups">
                                    <div class="row">
                                        <div class="col-4 text-start">
                                            <button
                                                v-show="filteredTrades[itemTradeIndex].trades.hasOwnProperty(tradeIndex - 1)"
                                                class="btn btn-outline-primary btn-sm ms-3 mb-2"
                                                v-on:click="clickTradesModal(itemTradeIndex, tradeIndex, tradeIndex - 1)"
                                                v-bind:disabled="spinnerSetups == true">
                                                <i class="fa fa-chevron-left me-2"></i></button>
                                        </div>
                                        <div class="col-4 text-center">
                                            <button v-if="saveButton" class="btn btn-outline-success btn-sm"
                                                v-on:click="clickTradesModal()">Close
                                                & Save</button>
                                            <button v-else class="btn btn-outline-primary btn-sm"
                                                v-on:click="clickTradesModal()">Close</button>
                                        </div>
                                        <div v-show="filteredTrades[itemTradeIndex].trades.hasOwnProperty(tradeIndex + 1)"
                                            class="ms-auto col-4 text-end">
                                            <button class="btn btn-outline-primary btn-sm me-3 mb-2"
                                                v-on:click="clickTradesModal(itemTradeIndex, tradeIndex, tradeIndex + 1)"
                                                v-bind:disabled="spinnerSetups == true">
                                                <i class="fa fa-chevron-right ms-2"></i></button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Spinner -->
                                <div v-show="spinnerSetups" class="col-12">
                                    <div class="d-flex justify-content-center">
                                        <div class="spinner-border spinner-border-sm text-blue" role="status"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <hr>
                </div>
            </div>
        </div>
    </div>

    <!-- ============ TAGS MODAL ============ -->
    <div class="modal fade" id="tagsModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1"
        aria-labelledby="exampleModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl">
            <div class="modal-content">
                <!-- Tags -->
                <div class="container col mt-4">
                    <div class="form-control dropdown form-select" style="height: auto;">
                        <div style="display: flex; align-items: center; flex-wrap: wrap;">
                            <span v-for="(tag, index) in tradeTags" :key="index" class="tag txt-small"
                                :style="{ 'background-color': useGetTagInfo(tag.id).groupColor }"
                                @click="useTradeTagsChange('remove', index)">
                                {{ tag.name }}<span class="remove-tag">×</span>
                            </span>

                            <input type="text" v-model="tagInput" @input="useFilterTags"
                                @keydown.enter.prevent="useTradeTagsChange('add', tagInput)"
                                @keydown.tab.prevent="useTradeTagsChange('add', tagInput)"
                                class="form-control tag-input" placeholder="Add a tag">
                            <div class="clickable-area" v-on:click="useToggleTagsDropdown">
                            </div>
                        </div>
                    </div>

                    <ul id="dropdown-menu-tags" class="dropdown-menu-tags"
                        :style="[!showTagsList ? 'border: none;' : '']">
                        <span v-show="showTagsList" v-for="group in availableTags">
                            <h6 class="p-1 mb-0" :style="'background-color: ' + group.color + ';'"
                                v-show="useFilterSuggestions(group.id).filter(obj => obj.id == group.id)[0].tags.length > 0">
                                {{ group.name }}</h6>
                            <li v-for="(suggestion, index) in useFilterSuggestions(group.id).filter(obj => obj.id == group.id)[0].tags"
                                :key="index" :class="{ active: index === selectedTagIndex }"
                                @click="useTradeTagsChange('addFromDropdownMenu', suggestion)"
                                class="dropdown-item dropdown-item-tags">
                                <span class="ms-2">{{ suggestion.name }}</span>
                            </li>
                        </span>
                    </ul>
                </div>
                <div class="col text-center mt-4 mb-4">
                    <button class="btn btn-outline-primary btn-sm" v-on:click="closeTagsModal">Close</button>
                    <button class="btn btn-outline-success btn-sm ms-4" v-on:click="saveDailyTags()">Save</button>
                </div>
            </div>
        </div>
    </div>

</template>