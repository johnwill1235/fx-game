// FX Trading Game Logic

console.log("FX Game script loaded.");

// --- Game State ---
let currencies = {}; // Holds current rates and volatility
// Portfolio now stores objects for non-USD currencies to hold orders
// Example: { EUR: { amount: 100, stopLoss: 0.90, takeProfit: 0.95 }, USD: 10000 }
let playerPortfolio = {};
let initialPortfolioValue = 0; // Portfolio value at the start of the game
let currentPortfolioValue = 0; // Updated portfolio value each round
let currentEvent = null;
let currentIndicators = null; // NEW: To hold the indicator data for the round
let round = 0;
const totalRounds = 10;
let roundInProgress = false;
let initialPlayerRates = {}; // Store rates *before* event for comparison/display
let historicalRates = []; // Stores { code: { rate, volatility, interest_rate } } snapshots
const maxHistoryPoints = 15; // NEW: Max history points for chart

// NEW: Spread configuration (e.g., 0.05% base spread + volatility factor)
const baseSpreadPercentage = 0.0005; // 0.05%
const volatilitySpreadFactor = 0.5; // How much volatility contributes to spread

// NEW: Leverage and Margin Settings
const leverage = 10; // e.g., 10:1 leverage
let usedMargin = 0;
let freeMargin = 0;
let marginLevel = Infinity; // Margin Level % (Equity / Used Margin * 100)
let playedMarginWarningThisRound = false; // NEW: Flag for margin warning sound

// --- Difficulty Settings ---
const difficulties = {
    easy: {
        name: "Easy",
        startingUSD: 20000,
        leverage: 5,
        spreadMultiplier: 0.8,
        impactMultiplier: 0.7,
        marginCallLevel: 50, // % Margin Level before game over
    },
    normal: {
        name: "Normal",
        startingUSD: 10000,
        leverage: 10,
        spreadMultiplier: 1.0,
        impactMultiplier: 1.0,
        marginCallLevel: 80,
    },
    hard: {
        name: "Hard",
        startingUSD: 5000,
        leverage: 20,
        spreadMultiplier: 1.2,
        impactMultiplier: 1.3,
        marginCallLevel: 100,
    },
};
let selectedDifficulty = difficulties.normal; // Default

// Initial currency data (Base: USD) - ADDED Interest Rates (Annualized %)
const initialCurrencies = {
    USD: { name: 'US Dollar', symbol: '$', rate: 1.0, volatility: 0.0, interest_rate: 5.25 }, // Example Fed Rate
    EUR: { name: 'Euro', symbol: '€', rate: 0.92, volatility: 0.01, interest_rate: 4.50 }, // Example ECB Rate
    JPY: { name: 'Japanese Yen', symbol: '¥', rate: 157.0, volatility: 0.015, interest_rate: 0.10 }, // Example BoJ Rate
    GBP: { name: 'British Pound', symbol: '£', rate: 0.79, volatility: 0.008, interest_rate: 5.00 }, // Example BoE Rate
    CAD: { name: 'Canadian Dollar', symbol: 'C$', rate: 1.37, volatility: 0.009, interest_rate: 4.75 }, // Example BoC Rate
    AUD: { name: 'Australian Dollar', symbol: 'A$', rate: 1.50, volatility: 0.011, interest_rate: 4.25 }, // Example RBA Rate
    CHF: { name: 'Swiss Franc', symbol: 'Fr', rate: 0.90, volatility: 0.007, interest_rate: 1.75 }, // Example SNB Rate
};

// Updated base portfolio structure
const baseStartingPortfolio = {
    USD: 0, // Set by difficulty
    EUR: { amount: 0, stopLoss: null, takeProfit: null },
    JPY: { amount: 0, stopLoss: null, takeProfit: null },
    GBP: { amount: 0, stopLoss: null, takeProfit: null },
    CAD: { amount: 0, stopLoss: null, takeProfit: null },
    AUD: { amount: 0, stopLoss: null, takeProfit: null },
    CHF: { amount: 0, stopLoss: null, takeProfit: null },
};

// --- Game Elements (DOM) ---
let portfolioValueElement; // Replaces scoreElement
let pnlElement; // To show Profit/Loss
let eventDescriptionElement;
let currencyListElement; // Will now include trade inputs
let portfolioDisplayElement; // New element to show holdings
// Prediction form becomes trade execution button area
let tradeButtonElement;
let resultsDisplayElement; // Will show round summary (P&L change)
let roundSummaryElement; // Replaces roundScoreElement
let resultDetailsElement; // Can show details of portfolio change
let nextRoundButton;
let difficultySelectionElement; // NEW: Container for difficulty buttons
let gameContainerElement; // NEW: Reference to the main game area to show/hide

// --- News Feed Data ---
const newsHeadlines = [
    // Major - Positive USD
    { text: "US Job Growth Smashes Expectations! Fed Hike More Likely.", impact: 'Major', sentiment: { USD: 1.0 }, category: 'Economy' },
    { text: "Breakthrough US Tech Deal Announced, Major Investment Inflow Expected.", impact: 'Major', sentiment: { USD: 0.8 }, category: 'Business' },
    // Major - Negative USD
    { text: "Worrying US Retail Sales Slump Deepens Recession Fears.", impact: 'Major', sentiment: { USD: -1.0 }, category: 'Economy' },
    { text: "Political Gridlock in Washington Shakes Investor Confidence.", impact: 'Major', sentiment: { USD: -0.8 }, category: 'Politics' },
    // Major - Positive EUR
    { text: "ECB President Strikes Hawkish Tone, Signals More Rate Hikes.", impact: 'Major', sentiment: { EUR: 1.0 }, category: 'CentralBank' },
    { text: "Strong German Export Data Boosts Eurozone Growth Outlook.", impact: 'Major', sentiment: { EUR: 0.8 }, category: 'Economy' },
    // Major - Negative EUR
    { text: "EU Summit Ends Without Agreement on Key Fiscal Measures.", impact: 'Major', sentiment: { EUR: -0.9 }, category: 'Politics' },
    { text: "Italian Debt Concerns Resurface, Weighing on the Euro.", impact: 'Major', sentiment: { EUR: -0.7 }, category: 'Economy' },
    // Minor - Positive/Negative for various
    { text: "UK House Prices Show Modest Increase.", impact: 'Minor', sentiment: { GBP: 0.3 }, category: 'Economy' },
    { text: "Japanese Consumer Confidence Ticks Slightly Higher.", impact: 'Minor', sentiment: { JPY: 0.2 }, category: 'Economy' },
    { text: "Canadian Oil Exports Face Minor Disruption.", impact: 'Minor', sentiment: { CAD: -0.3 }, category: 'Commodity' },
    { text: "Australian Central Bank Holds Rates Steady, as Expected.", impact: 'Minor', sentiment: { AUD: 0.0 }, category: 'CentralBank' },
    { text: "Swiss Watch Exports See Slight Decline.", impact: 'Minor', sentiment: { CHF: -0.2 }, category: 'Business' },
    // Noise / General Market
    { text: "Analysts Debate Long-Term FX Trends Amid Global Uncertainty.", impact: 'Noise', sentiment: {}, category: 'Market' },
    { text: "Trading Volumes Remain Subdued Ahead of Holiday Weekend.", impact: 'Noise', sentiment: {}, category: 'Market' },
    { text: "Tech Stocks Edge Higher in Pre-Market Trading.", impact: 'Noise', sentiment: {}, category: 'Market' },
    { text: "Cryptocurrency Market Experiences Another Volatile Swing.", impact: 'Noise', sentiment: {}, category: 'Market' },
];

// State for News Feed and Sentiment
let currentNewsFeed = [];
let marketSentiment = 'Neutral'; // Can be Bullish, Neutral, Bearish (overall)

// Add DOM elements for news feed and sentiment display
let newsFeedElement;
let sentimentIndicatorElement;

// --- Sound Effects --- 
const soundCache = {}; // Cache Audio objects

function playSound(filename) {
    // Basic check for user interaction context (often required for audio autoplay)
    // This might need refinement depending on browser policies.
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
         // Web Audio API is available, audio should generally work after user interaction.
    } else {
        console.warn("Web Audio API not fully supported. Sounds might not play.");
        // return; // Optionally prevent trying if API is missing
    }

    try {
        let sound;
        if (soundCache[filename]) {
            sound = soundCache[filename];
            sound.currentTime = 0; // Rewind to start if playing again
        } else {
            sound = new Audio(`audio/${filename}`);
            soundCache[filename] = sound;
        }
        
        // Play the sound
        sound.play().catch(error => {
            // Autoplay restrictions are common. Log errors.
            // Sounds might only work reliably after the first user click (e.g., difficulty selection).
            if (error.name === 'NotAllowedError') {
                console.warn(`Audio autoplay prevented for ${filename}. User interaction likely required first.`);
            } else {
                console.error(`Error playing sound ${filename}:`, error);
            }
        });
    } catch (e) {
        console.error(`Could not create or play audio ${filename}:`, e);
    }
}

// --- Game Logic Functions ---

function getRandomEvent() {
    const randomIndex = Math.floor(Math.random() * events.length);
    return events[randomIndex];
}

function getRandomIndicator() {
    const randomIndex = Math.floor(Math.random() * economicIndicators.length);
    return economicIndicators[randomIndex];
}

function applyEventEffects(event, indicators) {
    console.log(`Applying event: ${event.description}`);
    if (indicators) {
        console.log(`Applying indicator: ${indicators.name} - ${indicators.report}`);
    }

    let combinedEffects = {};
    for (const code in currencies) {
        // Initialize with rate=1, vol=1, int_rate_change=0
        combinedEffects[code] = { rate: 1.0, volatility: 1.0, interest_rate_change: 0.0 };
    }

    // Aggregate effects from event
    if (event && event.effects) {
    for (const currencyCode in event.effects) {
            const effect = event.effects[currencyCode];
            if (combinedEffects[currencyCode]) {
                if (effect.rate) combinedEffects[currencyCode].rate *= effect.rate;
                if (effect.volatility) combinedEffects[currencyCode].volatility *= effect.volatility;
                // ADD interest rate change (additively)
                if (effect.interest_rate_change) combinedEffects[currencyCode].interest_rate_change += effect.interest_rate_change;
            }
        }
    }

    // Aggregate effects from indicators
    if (indicators && indicators.effects) {
        for (const currencyCode in indicators.effects) {
            const effect = indicators.effects[currencyCode];
            if (combinedEffects[currencyCode]) {
                if (effect.rate) combinedEffects[currencyCode].rate *= effect.rate;
                if (effect.volatility) combinedEffects[currencyCode].volatility *= effect.volatility;
                // ADD interest rate change (additively)
                if (effect.interest_rate_change) combinedEffects[currencyCode].interest_rate_change += effect.interest_rate_change;
            }
        }
    }

    // Apply the combined effects, SCALED by difficulty multiplier
    console.log("Base Combined Effects:", JSON.parse(JSON.stringify(combinedEffects))); // Log before scaling
    const impactMultiplier = selectedDifficulty.impactMultiplier;
    for (const currencyCode in combinedEffects) {
        if (currencies[currencyCode]) {
            const effect = combinedEffects[currencyCode];

            // Scale rate change (relative to 1.0)
            const baseRateEffect = effect.rate - 1.0;
            const scaledRateEffect = baseRateEffect * impactMultiplier;
            currencies[currencyCode].rate *= (1.0 + scaledRateEffect);
            currencies[currencyCode].rate = parseFloat(currencies[currencyCode].rate.toFixed(4));

            // Scale volatility change (relative to 1.0)
            const baseVolEffect = effect.volatility - 1.0;
            const scaledVolEffect = baseVolEffect * impactMultiplier;
            currencies[currencyCode].volatility *= (1.0 + scaledVolEffect);
            currencies[currencyCode].volatility = Math.max(0.001, parseFloat(currencies[currencyCode].volatility.toFixed(4)));

            // Scale interest rate change (absolute change)
            const scaledInterestChange = effect.interest_rate_change * impactMultiplier;
            currencies[currencyCode].interest_rate += scaledInterestChange;
            currencies[currencyCode].interest_rate = Math.max(0, parseFloat(currencies[currencyCode].interest_rate.toFixed(2)));
        }
    }
    console.log("Currencies after scaled effects:", currencies);
}

// Calculates Equity
function calculatePortfolioValue(rates) {
    let totalValue = 0;
    for (const code in playerPortfolio) {
        if (code === 'USD') {
            totalValue += playerPortfolio[code]; // Add cash directly
        } else if (rates[code] && playerPortfolio[code].amount !== 0) {
            const midRate = rates[code].rate;
            if (midRate > 0) {
                // Add value of non-USD holdings
                totalValue += playerPortfolio[code].amount / midRate;
            }
        }
    }
    return totalValue;
}

// Calculates Used Margin
function calculateUsedMargin(rates) {
    let totalUsedMargin = 0;
    for (const code in playerPortfolio) {
        if (code === 'USD' || playerPortfolio[code].amount === 0) continue;

        if (rates[code]) {
            const midRate = rates[code].rate;
            if (midRate > 0) {
                const positionValueUSD = Math.abs(playerPortfolio[code].amount / midRate);
                const marginForPosition = positionValueUSD / selectedDifficulty.leverage;
                totalUsedMargin += marginForPosition;
            }
        }
    }
    return totalUsedMargin;
}

function displayPortfolio() {
    // Display Holdings (adapting to new structure)
    portfolioDisplayElement.innerHTML = '<h3>Your Holdings:</h3>';
    const ulHoldings = document.createElement('ul');
    for (const code in playerPortfolio) {
        const li = document.createElement('li');
        const currencyInfo = initialCurrencies[code];
        if (code === 'USD') {
            li.textContent = `${currencyInfo.name} (${code}): ${playerPortfolio[code].toFixed(2)} ${currencyInfo.symbol}`;
        } else {
            const position = playerPortfolio[code];
            let slText = position.stopLoss ? `SL: ${position.stopLoss.toFixed(4)}` : 'SL: None';
            let tpText = position.takeProfit ? `TP: ${position.takeProfit.toFixed(4)}` : 'TP: None';
            li.textContent = `${currencyInfo.name} (${code}): ${position.amount.toFixed(4)} (${slText}, ${tpText})`;
        }
        ulHoldings.appendChild(li);
    }
    portfolioDisplayElement.appendChild(ulHoldings);

    // --- Update Margin Display --- 
    // Calculate current equity using current rates
    const currentEquity = calculatePortfolioValue(currencies);
    // Update leverage based on difficulty IN CASE it changes (though it shouldn't mid-game)
    leverage = selectedDifficulty.leverage;
    usedMargin = calculateUsedMargin(currencies);
    freeMargin = currentEquity - usedMargin;
    marginLevel = (usedMargin > 0) ? (currentEquity / usedMargin) * 100 : Infinity;

    // Update total value display (Equity)
    portfolioValueElement.textContent = `\$${currentEquity.toFixed(2)}`;
    const pnl = currentEquity - initialPortfolioValue;
    const pnlPercent = (initialPortfolioValue !== 0) ? ((pnl / initialPortfolioValue) * 100).toFixed(2) : 0;
    pnlElement.textContent = `P/L: \$${pnl.toFixed(2)} (${pnlPercent}%)`;
    pnlElement.className = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';

    // --- Margin Call Check & Warning Sound ---
    if (isFinite(marginLevel)) {
        if (marginLevel < selectedDifficulty.marginCallLevel) {
            console.warn(`MARGIN CALL! Margin Level: ${marginLevel.toFixed(1)}% < ${selectedDifficulty.marginCallLevel}%`);
            endGame(true); // Pass true to indicate margin call
            return; // Stop further updates if game ended
        } else if (marginLevel < selectedDifficulty.marginCallLevel + 20 && !playedMarginWarningThisRound) {
            // Play warning only if below threshold + 20% and haven't played it this round
            console.log("Playing margin warning sound.");
            playSound('margin_warning.wav');
            playedMarginWarningThisRound = true; // Set flag for this round
        }
    }
    // --- End Margin Call Check ---

    // Display margin info (needs corresponding elements in HTML)
    const marginInfoUl = portfolioDisplayElement.querySelector('.margin-info') || document.createElement('ul');
    marginInfoUl.innerHTML = `
        <li>Leverage: ${leverage}:1</li>
        <li>Used Margin: \$${usedMargin.toFixed(2)}</li>
        <li>Free Margin: \$${freeMargin.toFixed(2)}</li>
        <li>Margin Level: ${isFinite(marginLevel) ? marginLevel.toFixed(1) + '%' : 'N/A'} ${marginLevel < selectedDifficulty.marginCallLevel + 20 ? '<span style="color: red;">(Low)</span>' : ''}</li>
    `;
    if (!marginInfoUl.classList.contains('margin-info')) {
        marginInfoUl.classList.add('margin-info');
        portfolioDisplayElement.appendChild(marginInfoUl);
    }
    // --- End Margin Display Update --- 
}

// NEW: Renders a simple SVG line chart for historical rates
function renderRateChart(containerElement, rateHistory) {
    containerElement.innerHTML = ''; // Clear previous chart
    if (!rateHistory || rateHistory.length < 2) {
        containerElement.textContent = '-'; // Not enough data
        return;
    }

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    const padding = 2; // Reduced padding
    const chartWidth = 100; // SVG internal width
    const chartHeight = 25; // SVG internal height
    svg.setAttribute("viewBox", `0 0 ${chartWidth} ${chartHeight}`);
    svg.style.width = "100%"; // Make it responsive within its container
    svg.style.height = "25px"; // Fixed height for consistency
    svg.style.overflow = "visible"; // Allow stroke to go slightly outside bounds if needed

    // Find min/max rates in the history slice for scaling
    const rates = rateHistory.map(r => r.rate);
    let minRate = Math.min(...rates);
    let maxRate = Math.max(...rates);
    const rateRange = maxRate - minRate;

    // Add tiny padding to min/max to prevent flat lines touching edges
    const verticalPadding = rateRange * 0.1; // 10% padding
    minRate -= verticalPadding;
    maxRate += verticalPadding;
    // Recalculate range with padding
    const paddedRateRange = maxRate - minRate;

    // Handle zero range after padding (highly unlikely but safe)
    if (paddedRateRange === 0) {
        minRate -= 0.001; // Add small range
        maxRate += 0.001;
    }

    // Calculate points for the polyline
    const points = rateHistory.map((dataPoint, index) => {
        const x = padding + (index / (rateHistory.length - 1)) * (chartWidth - 2 * padding);
        const yValue = dataPoint.rate;
        // Scale y-coordinate (inverted y-axis in SVG)
        const y = (chartHeight - padding) - ((yValue - minRate) / (maxRate - minRate)) * (chartHeight - 2 * padding);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const polyline = document.createElementNS(svgNS, "polyline");
    polyline.setAttribute("points", points);
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", "#3498db"); // Blue line color
    polyline.setAttribute("stroke-width", "1.5");
    polyline.setAttribute("stroke-linecap", "round");
    polyline.setAttribute("stroke-linejoin", "round");

    svg.appendChild(polyline);
    containerElement.appendChild(svg);
}

function displayCurrenciesAndTrade() {
    currencyListElement.innerHTML = ''; // Clear previous list

    const headerLi = document.createElement('li');
    headerLi.classList.add('currency-header-trade');
    // Update headers to add SL/TP info display (maybe combine with trade action?)
    headerLi.innerHTML = `
        <span>Currency</span>
        <span>Sell (Bid)</span>
        <span>Buy (Ask)</span>
        <span title="Recent rate trend">Chart</span>
        <span title="Annual Rate">Int. Rate</span>
        <span>Volatility</span>
        <span>Trade Action / Orders</span> <!-- Combined Column -->
    `;
    currencyListElement.appendChild(headerLi);

    const historyDepth = historicalRates.length;
    const relevantHistory = historicalRates.slice(-maxHistoryPoints);

    for (const code in currencies) {
        if (code === 'USD') continue;

        const currency = currencies[code];
        const { bid, ask, mid } = getBidAsk(code);

        const currencyHistory = relevantHistory.map(snap => snap[code]).filter(Boolean);

        const midRateBeforeCurrentEvent = initialPlayerRates[code] ?? mid;
        const change = mid - midRateBeforeCurrentEvent;
        let changeIndicator = '';
        if (roundInProgress && Math.abs(change) > 0.00005) {
             changeIndicator = change > 0 ? '<span class="rate-up">▲</span>' : '<span class="rate-down">▼</span>';
        }

        const position = playerPortfolio[code]; // Get current position data
        const hasPosition = position && position.amount !== 0;

        const li = document.createElement('li');
        li.dataset.currencyCode = code;
        // Add SL/TP input fields & display current orders
        li.innerHTML = `
            <span>${currency.name} (${code})</span>
            <span class="bid-price">${currency.symbol} ${bid.toFixed(4)}</span>
            <span class="ask-price">${currency.symbol} ${ask.toFixed(4)} ${changeIndicator}</span>
            <div class="rate-chart-container"></div>
            <span class="interest-rate">${currency.interest_rate.toFixed(2)}%</span>
            <span class="volatility">${currency.volatility.toFixed(4)}</span>
            <span class="trade-controls">
                 <div class="trade-inputs">
                    <input type="number" class="trade-amount" placeholder="USD Amt" min="0" step="10">
                    <input type="number" class="stop-loss-input" placeholder="Stop Loss" step="0.0001" ${hasPosition ? '' : 'disabled'}>
                    <input type="number" class="take-profit-input" placeholder="Take Profit" step="0.0001" ${hasPosition ? '' : 'disabled'}>
                 </div>
                 <div class="trade-buttons">
                    <button class="trade-btn buy" data-action="buy" title="Buy ${code}">Buy</button>
                    <button class="trade-btn sell" data-action="sell" title="Sell ${code}">Sell</button>
                    <span class="order-status">${position.stopLoss ? `SL:${position.stopLoss.toFixed(4)}`:''} ${position.takeProfit ? `TP:${position.takeProfit.toFixed(4)}`: ''}</span>
                 </div>
            </span>
        `;
        currencyListElement.appendChild(li);

        const chartContainer = li.querySelector('.rate-chart-container');
        renderRateChart(chartContainer, currencyHistory);
    }
}

// NEW: Function to calculate overall market sentiment
function calculateMarketSentiment(event, indicators, news) {
    let score = 0;
    const weights = { Major: 3, Minor: 1, Noise: 0 };

    // Add sentiment from the main event (if applicable)
    // Simplified: Assume events array could have a sentiment score too
    // For now, let's use indicators/news primarily

    // Add sentiment from the indicator
    if (indicators && indicators.sentiment_score) { // Assuming indicators might have a score
        score += indicators.sentiment_score * 2; // Give indicator decent weight
    }

    // Add sentiment from the news feed
    news.forEach(item => {
        let itemScore = 0;
        for (const code in item.sentiment) {
            itemScore += item.sentiment[code]; // Sum up sentiment values for the item
        }
        score += itemScore * weights[item.impact];
    });

    console.log("Calculated Sentiment Score:", score);

    // Determine overall sentiment state
    if (score > 2.5) return 'Strong Bullish';
    if (score > 0.5) return 'Bullish';
    if (score < -2.5) return 'Strong Bearish';
    if (score < -0.5) return 'Bearish';
    return 'Neutral';
}

// Update displayEvent to handle News Feed and Sentiment
function displayEvent(event, indicators, news) {
    eventDescriptionElement.innerHTML = ''; // Clear previous

    // Display Main Event & Indicator (as before)
    const eventP = document.createElement('p');
    eventP.innerHTML = `<strong>Event:</strong> ${event ? event.description : '-'}`;
    eventDescriptionElement.appendChild(eventP);
    if (indicators) { /* ... display indicator details ... */ }

    // --- Populate News Feed --- 
    newsFeedElement.innerHTML = '<h4>News Headlines</h4>';
    const newsList = document.createElement('ul');
    news.forEach(item => {
        const li = document.createElement('li');
        li.classList.add(`impact-${item.impact.toLowerCase()}`);
        li.textContent = item.text;
        newsList.appendChild(li);
    });
    newsFeedElement.appendChild(newsList);
    // --- End News Feed ---

    // --- Update Sentiment Display --- 
    marketSentiment = calculateMarketSentiment(event, indicators, news);
    sentimentIndicatorElement.textContent = marketSentiment;
    // Add class for styling based on sentiment
    sentimentIndicatorElement.className = 'sentiment-indicator '; // Reset classes
    sentimentIndicatorElement.classList.add(`sentiment-${marketSentiment.toLowerCase().replace(' ', '-')}`);
    // --- End Sentiment Display ---
}

// Renamed from getUserPredictions - Processes trades based on inputs
function processTrades() {
    console.log("Processing trades...");
    const tradeRows = currencyListElement.querySelectorAll('li[data-currency-code]');
    let tradesExecuted = false;

    tradeRows.forEach(row => {
        const code = row.dataset.currencyCode;
        const amountInput = row.querySelector('.trade-amount');
        const slInput = row.querySelector('.stop-loss-input');
        const tpInput = row.querySelector('.take-profit-input');
        const usdAmount = parseFloat(amountInput.value);
        const stopLossRate = parseFloat(slInput.value) || null;
        const takeProfitRate = parseFloat(tpInput.value) || null;

        if (!isNaN(usdAmount) && usdAmount > 0) {
            // Find which button was intended (this needs better handling, maybe disable inputs after one trade?)
            // For now, let's assume the input applies to both potential actions (Buy/Sell)
            // This part needs refinement for a real UI. A simpler approach for now:
            // Let's assume the input is linked to explicit Buy/Sell clicks triggered elsewhere.
            // --- OR --- Modify UI to have one input per row and dedicated Buy/Sell buttons that read it.

            // *** SIMPLIFICATION for now: ***
            // We'll handle trades via event listeners on the Buy/Sell buttons directly.
            // This function might just validate the state or be removed if logic moves entirely to listeners.
            // For now, let's just log the *potential* trade amounts found.
            console.log(`Potential trade detected for ${code}: ${usdAmount} USD`);
            // We will implement the actual trade logic in the event listener handler.
        }
        // Clear input after processing (or attempting)
        amountInput.value = '';
        slInput.value = '';
        tpInput.value = '';

    });

    // After potentially processing trades, update the portfolio display immediately
    currentPortfolioValue = calculatePortfolioValue(currencies); // Recalculate based on current rates
    displayPortfolio();
}

// Update handleTradeAction to read/set SL/TP
function handleTradeAction(event) {
    if (!roundInProgress) return;
    if (!event.target.matches('.trade-btn')) return;

    const action = event.target.dataset.action;
    const row = event.target.closest('li[data-currency-code]');
    const code = row.dataset.currencyCode;
    const amountInput = row.querySelector('.trade-amount');
    const slInput = row.querySelector('.stop-loss-input');
    const tpInput = row.querySelector('.take-profit-input');
    const usdAmount = parseFloat(amountInput.value); // This is the *Notional Value* of the trade in USD

    const { bid, ask, mid } = getBidAsk(code);

    const stopLossRate = parseFloat(slInput.value) || null;
    const takeProfitRate = parseFloat(tpInput.value) || null;

    if (isNaN(usdAmount) || usdAmount <= 0) {
        alert('Please enter a valid positive trade amount in USD.');
        amountInput.focus();
        return;
    }

    // --- Margin Check --- 
    const marginRequiredForTrade = usdAmount / selectedDifficulty.leverage;
    // Recalculate free margin based on current equity and used margin *before* this trade
    const currentEquity = calculatePortfolioValue(currencies);
    const currentUsedMargin = calculateUsedMargin(currencies);
    const currentFreeMargin = currentEquity - currentUsedMargin;

    if (currentFreeMargin < marginRequiredForTrade) {
        alert(`Insufficient free margin. Required: \$${marginRequiredForTrade.toFixed(2)}, Available: \$${currentFreeMargin.toFixed(2)}`);
        return;
    }
    // --- End Margin Check ---

    console.log(`Attempting to ${action} ${code} with \$${usdAmount} notional value. Margin Required: \$${marginRequiredForTrade.toFixed(2)}`);

    // --- Store current amount before trade --- 
    const amountBefore = playerPortfolio[code].amount;

    // Execute trade (adjust portfolio amount)
    let tradeExecuted = false;
    if (action === 'buy') {
        const rate = ask;
        const amountToBuy = usdAmount / rate; // Amount of foreign currency
        // Note: We don't directly subtract margin from USD. USD changes only if we realize P/L or pay interest.
        // Margin is just a requirement based on equity.
        playerPortfolio[code].amount += amountToBuy;
        console.log(`Bought ${amountToBuy.toFixed(4)} ${code} at ${rate.toFixed(4)}`);
        tradeExecuted = true;
    } else if (action === 'sell') {
        const rate = bid;
        // Check if selling would create *too large* a short position relative to margin (optional check)
        // For simplicity, we allow shorting. The margin calculation handles the risk.
        const amountToSell = usdAmount / rate; // Amount of foreign currency to sell
        playerPortfolio[code].amount -= amountToSell;
        console.log(`Sold ${amountToSell.toFixed(4)} ${code} at ${rate.toFixed(4)}`);
        tradeExecuted = true;
    }

    const amountAfter = playerPortfolio[code].amount;

    // --- Update SL/TP based on trade --- 
    // If position was opened or increased, update SL/TP from inputs
    if ((amountBefore === 0 && amountAfter !== 0) || (Math.sign(amountAfter) === Math.sign(amountBefore) && Math.abs(amountAfter) > Math.abs(amountBefore))) {
        playerPortfolio[code].stopLoss = stopLossRate;
        playerPortfolio[code].takeProfit = takeProfitRate;
        console.log(`Set/Updated SL/TP for ${code}: SL=${stopLossRate}, TP=${takeProfitRate}`);
    }
    // If position was closed, clear SL/TP
    else if (amountAfter === 0) {
        playerPortfolio[code].stopLoss = null;
        playerPortfolio[code].takeProfit = null;
        console.log(`Cleared SL/TP for ${code} as position closed.`);
    }
    // If position reduced but not closed, SL/TP remain unchanged for now.

    amountInput.value = '';
    slInput.value = ''; // Clear inputs
    tpInput.value = '';
    // Re-enable SL/TP inputs only if position exists after trade
    slInput.disabled = playerPortfolio[code].amount === 0;
    tpInput.disabled = playerPortfolio[code].amount === 0;

    // Update portfolio display (incl. margin check)
    displayPortfolio();

    if (tradeExecuted) {
        playSound('trade_confirm.wav'); // Play sound on success
    }
}

// Renamed from evaluatePredictions - Calculates P&L after event
function finalizeRound() {
    console.log("Finalizing round...");
    roundInProgress = false;

    // --- Interest Calculation ---
    let interestEarnedPaid = 0;
    const baseRate = currencies['USD'].interest_rate / 100;
    const startRates = {};
    for(const code in currencies) {
        startRates[code] = {
            rate: initialPlayerRates[code] ?? currencies[code].rate,
            interest_rate: currencies[code].interest_rate
        };
    }
    for (const code in playerPortfolio) {
        if (code === 'USD' || playerPortfolio[code].amount === 0) continue;

        const foreignAmount = playerPortfolio[code].amount;
        const currencyData = startRates[code]; // Use start-of-round data
        if (!currencyData) continue; // Safety check

        const foreignRate = currencyData.interest_rate / 100;
        const valuationRate = currencyData.rate;

        if (valuationRate > 0) {
            const positionValueUSD = foreignAmount / valuationRate;
            const rateDifferential = foreignRate - baseRate;
            const dailyInterest = positionValueUSD * rateDifferential * (1 / 365);
            interestEarnedPaid += dailyInterest;
            // console.log(`Interest on ${code}: ValUSD=${positionValueUSD.toFixed(2)}, RateDiff=${(rateDifferential * 100).toFixed(2)}%, DailyInt=${dailyInterest.toFixed(4)} USD`);
        }
    }
    playerPortfolio.USD += interestEarnedPaid;
    // --- End Interest Calculation ---

    // --- Calculate Value Before Rate Changes ---
    // Equity value using start-of-round rates, after trades and interest accrual
    const valueBeforeRateEffects = calculatePortfolioValue(startRates);
    console.log(`Value after trades & interest (using start rates): $${valueBeforeRateEffects.toFixed(2)}`);
    // --- End Pre-Value Calculation ---

    // Apply Event/Indicator Effects
    applyEventEffects(currentEvent, currentIndicators);

    // --- Check SL/TP Orders --- 
    console.log("Checking Stop Loss / Take Profit orders...");
    let ordersTriggered = false;
    for (const code in playerPortfolio) {
        if (code === 'USD' || playerPortfolio[code].amount === 0) continue;

        const position = playerPortfolio[code];
        const { bid, ask } = getBidAsk(code); // Get current prices AFTER event effects

        let closePosition = false;
        let closeReason = '';

        // Check Stop Loss
        if (position.stopLoss !== null) {
            if (position.amount > 0 && bid <= position.stopLoss) { // Long position hits SL
                closePosition = true;
                closeReason = `Stop Loss triggered at ${bid.toFixed(4)} (<= ${position.stopLoss.toFixed(4)})`;
            } else if (position.amount < 0 && ask >= position.stopLoss) { // Short position hits SL
                closePosition = true;
                closeReason = `Stop Loss triggered at ${ask.toFixed(4)} (>= ${position.stopLoss.toFixed(4)})`;
            }
        }

        // Check Take Profit (only if SL wasn't hit)
        if (!closePosition && position.takeProfit !== null) {
            if (position.amount > 0 && bid >= position.takeProfit) { // Long position hits TP
                closePosition = true;
                closeReason = `Take Profit triggered at ${bid.toFixed(4)} (>= ${position.takeProfit.toFixed(4)})`;
            } else if (position.amount < 0 && ask <= position.takeProfit) { // Short position hits TP
                closePosition = true;
                closeReason = `Take Profit triggered at ${ask.toFixed(4)} (<= ${position.takeProfit.toFixed(4)})`;
            }
        }

        // Execute Closing Trade if Triggered
        if (closePosition) {
            console.log(`Closing position for ${code}: ${closeReason}`);
            ordersTriggered = true;
            const amountToClose = position.amount;
            if (amountToClose > 0) { // Close long position by selling
                const rate = bid;
                playerPortfolio.USD += (amountToClose / rate);
            } else { // Close short position by buying
                const rate = ask;
                playerPortfolio.USD -= (Math.abs(amountToClose) / rate);
            }
            // Reset position
            position.amount = 0;
            position.stopLoss = null;
            position.takeProfit = null;
        }
    }
    if (ordersTriggered) {
        console.log("Portfolio after SL/TP closures:", playerPortfolio);
    }
    // --- End Order Check --- 

    // Store History
    const ratesSnapshot = {};
    for (const code in currencies) { // Use the updated currencies object
        ratesSnapshot[code] = { rate: currencies[code].rate, volatility: currencies[code].volatility, interest_rate: currencies[code].interest_rate };
    }
    historicalRates.push(JSON.parse(JSON.stringify(ratesSnapshot)));
    if (historicalRates.length > maxHistoryPoints) {
        historicalRates.shift();
    }
    console.log(`Stored historical data for end of round ${round}. History size: ${historicalRates.length}`);
    // --- End History Storage ---

    // --- Final Valuation & PNL Calculation ---
    const finalPortfolioValue = calculatePortfolioValue(currencies); // Final Equity
    console.log(`Final Equity (after rate changes): $${finalPortfolioValue.toFixed(2)}`);

    // PNL Calculation
    const totalRoundPnl = finalPortfolioValue - valueBeforeRateEffects; // Total change this round
    const roundPnl_RateChange = totalRoundPnl - interestEarnedPaid;
    const totalPnl_Overall = finalPortfolioValue - initialPortfolioValue;
    // --- End Final Valuation & PNL ---

    // --- Update UI ---
    displayPortfolio(); // Recalculates and displays final equity, margin etc.

    resultsDisplayElement.style.display = 'block';
    currencyListElement.style.display = 'none';

    roundSummaryElement.textContent = `Round ${round} P/L: \$${totalRoundPnl.toFixed(2)}`;
    resultDetailsElement.innerHTML = `
        <li>Market Gain/Loss: \$${roundPnl_RateChange.toFixed(2)}</li>
        <li>Interest Earned/Paid: \$${interestEarnedPaid.toFixed(2)}</li>
        <li>Total P/L (Game): \$${totalPnl_Overall.toFixed(2)}</li>
    `;
    roundSummaryElement.className = totalRoundPnl >= 0 ? 'pnl-positive' : 'pnl-negative';

    console.log(`Round ${round} finished. Rate P/L: ${roundPnl_RateChange.toFixed(2)}, Interest P/L: ${interestEarnedPaid.toFixed(2)}, Total Round P/L: ${totalRoundPnl.toFixed(2)}, Overall P/L: ${totalPnl_Overall.toFixed(2)}`);
    // --- End UI Update ---

    // Next Round Button Logic
    if (round < totalRounds) {
        nextRoundButton.style.display = 'block';
    } else {
        nextRoundButton.style.display = 'none';
        endGame();
    }
    // --- End Next Round Button Logic ---

    playSound('round_end.wav'); // Play sound when results are shown
}

function nextRound() {
    resultsDisplayElement.style.display = 'none';
    nextRoundButton.style.display = 'none';
    currencyListElement.style.display = 'block';

    round++;
    console.log(`\n--- Starting Round ${round}/${totalRounds} ---`);

    if (round > totalRounds) {
        endGame();
        return;
    }

    roundInProgress = true;
    playedMarginWarningThisRound = false; // Reset margin warning flag

    // Store the current MID rates *before* the event/indicator for change comparison
    initialPlayerRates = {};
    for(const code in currencies) {
        initialPlayerRates[code] = currencies[code].rate; // Store mid-rate
    }
    console.log("Mid-Rates before effects:", initialPlayerRates);

    currentEvent = getRandomEvent();
    currentIndicators = getRandomIndicator();

    // --- Select News Headlines for the Feed --- 
    currentNewsFeed = [];
    const numHeadlines = 5; // Number of headlines to show
    const availableHeadlines = [...newsHeadlines]; // Copy pool
    for (let i = 0; i < numHeadlines; i++) {
        if (availableHeadlines.length === 0) break;
        const randomIndex = Math.floor(Math.random() * availableHeadlines.length);
        currentNewsFeed.push(availableHeadlines.splice(randomIndex, 1)[0]);
    }
    console.log("Selected News Feed:", currentNewsFeed);
    // --- End News Selection ---

    // Update Market Info Display (Event, Indicator, News, Sentiment)
    displayEvent(currentEvent, currentIndicators, currentNewsFeed);

    // Display currencies with current BID/ASK prices and trade options *before* effects
    displayCurrenciesAndTrade();
    displayPortfolio();

    console.log("Ready for player trading.");
    tradeButtonElement.style.display = 'block';

    playSound('event_alert.wav'); // Play alert sound when new info is displayed
}

function endGame(isMarginCall = false) {
    if (!roundInProgress && !isMarginCall) return; // Prevent multiple calls unless margin call
    roundInProgress = false;
    console.log(`--- Game Over (${isMarginCall ? 'Margin Call' : 'Normal'}) ---`);
    const finalPnl = currentPortfolioValue - initialPortfolioValue;
    const finalPnlPercent = ((finalPnl / initialPortfolioValue) * 100).toFixed(2);

    let endSound = '';
    if (isMarginCall) {
        eventDescriptionElement.textContent = `MARGIN CALL! Your margin level fell below ${selectedDifficulty.marginCallLevel}%. Game Over.`;
        eventDescriptionElement.style.color = 'red';
        eventDescriptionElement.style.fontWeight = 'bold';
        endSound = 'margin_call.wav';
    } else {
        eventDescriptionElement.textContent = `Game Over! Final Portfolio Value: \$${currentPortfolioValue.toFixed(2)}`;
        if (finalPnl >= 0) {
             endSound = 'game_over_win.wav';
        } else {
             endSound = 'game_over_loss.wav';
        }
    }

    currencyListElement.innerHTML = ''; // Clear trade list
    tradeButtonElement.style.display = 'none'; // Hide finalize button
    resultsDisplayElement.style.display = 'block'; // Show final results
    nextRoundButton.style.display = 'none';

    roundSummaryElement.textContent = `Final Result`;
    resultDetailsElement.innerHTML = `
        <li>Starting Value: \$${initialPortfolioValue.toFixed(2)}</li>
        <li>Ending Value: \$${currentPortfolioValue.toFixed(2)}</li>
        <li>Total P/L: \$${finalPnl.toFixed(2)} (${finalPnlPercent}%)</li>
    `;
    pnlElement.textContent = ''; // Clear round P/L display

    playSound(endSound); // Play appropriate end game sound
}

// --- Initialization ---
function setupDifficultySelection() {
    difficultySelectionElement = document.getElementById('difficulty-selection');
    gameContainerElement = document.querySelector('.game-container'); // Get main game area
    
    // Hide game container initially
    gameContainerElement.style.display = 'none';

    Object.keys(difficulties).forEach(key => {
        const button = document.createElement('button');
        button.textContent = difficulties[key].name;
        button.addEventListener('click', () => {
            initializeGame(key); // Pass selected difficulty key
        });
        difficultySelectionElement.appendChild(button);
    });
}

function initializeGame(difficultyKey = 'normal') {
    console.log(`Initializing game with difficulty: ${difficultyKey}`);
    selectedDifficulty = difficulties[difficultyKey];
    leverage = selectedDifficulty.leverage; // Set game leverage

    // Hide difficulty selection, show game container
    if (difficultySelectionElement) difficultySelectionElement.style.display = 'none';
    gameContainerElement.style.display = 'block';

    // Deep copies for game state
    currencies = JSON.parse(JSON.stringify(initialCurrencies));
    // Set starting USD based on difficulty
    playerPortfolio = JSON.parse(JSON.stringify(baseStartingPortfolio));
    playerPortfolio.USD = selectedDifficulty.startingUSD;

    // Calculate initial portfolio value (Equity)
    initialPortfolioValue = calculatePortfolioValue(currencies); // Value is initially just cash
    currentPortfolioValue = initialPortfolioValue;
    console.log(`Initial Equity: $${initialPortfolioValue.toFixed(2)}`);

    // Reset other state variables
    round = 0;
    historicalRates = [];
    currentEvent = null;
    currentIndicators = null;
    roundInProgress = false; // Ensure reset
    usedMargin = 0;
    freeMargin = initialPortfolioValue;
    marginLevel = Infinity;

    // Get DOM elements (if not already fetched globally)
    portfolioValueElement = document.getElementById('portfolio-value');
    pnlElement = document.getElementById('pnl-display');
    portfolioDisplayElement = document.getElementById('portfolio-display');
    eventDescriptionElement = document.getElementById('event-description');
    newsFeedElement = document.getElementById('news-feed');
    sentimentIndicatorElement = document.getElementById('sentiment-indicator');
    currencyListElement = document.getElementById('currency-list');
    tradeButtonElement = document.getElementById('finalize-trades-btn');
    resultsDisplayElement = document.getElementById('results-display');
    roundSummaryElement = document.getElementById('round-summary');
    resultDetailsElement = document.getElementById('result-details');
    nextRoundButton = document.getElementById('next-round-btn');

    // Setup Event Listeners (ensure this runs only once or is safe)
    if (!tradeButtonElement.dataset.listenerAttached) { // Prevent duplicate listeners
        currencyListElement.addEventListener('click', handleTradeAction);
        tradeButtonElement.addEventListener('click', () => {
        if (!roundInProgress) return;
            tradeButtonElement.style.display = 'none'; // Hide finalize button after click
            processTrades(); // Process any final input states (though logic moved to handleTradeAction mostly)
            finalizeRound(); // Apply event, calculate P&L, show results
        });
        nextRoundButton.addEventListener('click', () => { if (!roundInProgress) nextRound(); });
        tradeButtonElement.dataset.listenerAttached = 'true'; // Mark as attached
    }

    // Initial UI setup
    displayPortfolio();
    resultsDisplayElement.style.display = 'none'; // Hide results initially
    nextRoundButton.style.display = 'none'; // Hide next round initially
    tradeButtonElement.style.display = 'none'; // Hide finalize initially

    // Start the first round
    nextRound();
}

// Start by setting up difficulty selection
document.addEventListener('DOMContentLoaded', setupDifficultySelection);

// NEW: Function to calculate Bid/Ask prices
function getBidAsk(currencyCode) {
    const currency = currencies[currencyCode];
    if (!currency) return { bid: NaN, ask: NaN, mid: NaN };

    const midRate = currency.rate;
    // Apply difficulty spread multiplier
    const effectiveSpreadPercentage = baseSpreadPercentage * selectedDifficulty.spreadMultiplier;
    const spread = midRate * (effectiveSpreadPercentage + (currency.volatility * volatilitySpreadFactor));
    const halfSpread = spread / 2;

    // Bid: Price dealer buys at (player sells at) - Lower than mid
    const bid = midRate - halfSpread;
    // Ask: Price dealer sells at (player buys at) - Higher than mid
    const ask = midRate + halfSpread;

    // Ensure reasonable precision
    return {
        bid: parseFloat(bid.toFixed(4)),
        ask: parseFloat(ask.toFixed(4)),
        mid: parseFloat(midRate.toFixed(4)) // Keep mid for reference/valuation
    };
} 