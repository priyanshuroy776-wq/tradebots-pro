const API = "https://api.binance.com/api/v3";

const assets = [
  { name: "Bitcoin", symbol: "BTC", pair: "BTCUSDT", price: 0, change: 0 },
  { name: "Ethereum", symbol: "ETH", pair: "ETHUSDT", price: 0, change: 0 },
  { name: "BNB", symbol: "BNB", pair: "BNBUSDT", price: 0, change: 0 },
  { name: "Solana", symbol: "SOL", pair: "SOLUSDT", price: 0, change: 0 }
];

let selected = 0;
let balance = 10000;
let holdings = {};
let history = [];
let candles = [];
let requestId = 0;

const money = value =>
  "$" + Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

async function getJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Market data request failed: " + response.status);
  }

  return response.json();
}

function setStatus(message) {
  const status = document.querySelector(
    ".market-panel .section-heading .small"
  );

  if (status) status.textContent = message;
}

async function loadMarketPrices() {
  const results = await Promise.all(
    assets.map(async asset => {
      const data = await getJSON(
        `${API}/ticker/24hr?symbol=${asset.pair}`
      );

      return {
        symbol: asset.symbol,
        price: Number(data.lastPrice),
        change: Number(data.priceChangePercent)
      };
    })
  );

  results.forEach(result => {
    const asset = assets.find(a => a.symbol === result.symbol);
    asset.price = result.price;
    asset.change = result.change;
  });
}

async function loadCandles() {
  const currentRequest = ++requestId;
  const asset = assets[selected];

  const data = await getJSON(
    `${API}/klines?symbol=${asset.pair}&interval=15m&limit=60`
  );

  if (currentRequest !== requestId) return;

  candles = data.map(item => ({
    time: item[0],
    open: Number(item[1]),
    high: Number(item[2]),
    low: Number(item[3]),
    close: Number(item[4])
  }));

  renderAnalysis();
}

function ema(values, period) {
  if (!values.length) return 0;

  const multiplier = 2 / (period + 1);
  let result = values[0];

  for (let i = 1; i < values.length; i++) {
    result = values[i] * multiplier +
      result * (1 - multiplier);
  }

  return result;
}

function calculateRSI(values, period = 14) {
  if (values.length <= period) return 0;

  let gains = 0;
  let losses = 0;

  for (let i = values.length - period; i < values.length; i++) {
    const difference = values[i] - values[i - 1];

    if (difference > 0) gains += difference;
    else losses -= difference;
  }

  if (losses === 0) return 100;

  const averageGain = gains / period;
  const averageLoss = losses / period;

  return 100 - (100 / (1 + averageGain / averageLoss));
}

function drawChart(data) {
  const canvas = document.getElementById("priceChart");
  const rect = canvas.getBoundingClientRect();

  if (!rect.width || !rect.height || !data.length) return;

  const ratio = window.devicePixelRatio || 1;

  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = rect.width;
  const height = rect.height;

  const highest = Math.max(...data.map(c => c.high));
  const lowest = Math.min(...data.map(c => c.low));
  const range = highest - lowest || 1;

  const padding = 12;
  const chartHeight = height - padding * 2;
  const candleWidth = Math.max(3, width / data.length * 0.55);
  const gap = width / data.length;

  function y(price) {
    return padding +
      ((highest - price) / range) * chartHeight;
  }

  ctx.clearRect(0, 0, width, height);

  // Horizontal grid lines
  ctx.strokeStyle = "#26334a";
  ctx.lineWidth = 1;

  for (let i = 1; i <= 4; i++) {
    const lineY = (height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(width, lineY);
    ctx.stroke();
  }

  // Candlesticks
  data.forEach((candle, index) => {
    const x = index * gap + gap / 2;
    const rising = candle.close >= candle.open;

    ctx.strokeStyle = rising ? "#27d69b" : "#ff6577";
    ctx.fillStyle = rising ? "#27d69b" : "#ff6577";

    // Wick
    ctx.beginPath();
    ctx.moveTo(x, y(candle.high));
    ctx.lineTo(x, y(candle.low));
    ctx.stroke();

    // Candle body
    const top = y(Math.max(candle.open, candle.close));
    const bottom = y(Math.min(candle.open, candle.close));
    const bodyHeight = Math.max(2, bottom - top);

    ctx.fillRect(
      x - candleWidth / 2,
      top,
      candleWidth,
      bodyHeight
    );
  });
}

function portfolioValue() {
  let total = balance;

  assets.forEach(asset => {
    total += (holdings[asset.symbol] || 0) * asset.price;
  });

  return total;
}

function renderMarkets() {
  const list = document.getElementById("marketList");

  list.innerHTML = assets.map((asset, index) => `
    <div class="market-item ${index === selected ? "active" : ""}"
         data-index="${index}">
      <div>
        <div class="coin-name">${asset.name}</div>
        <div class="coin-symbol">${asset.symbol}</div>
      </div>
      <div style="text-align:right">
        <div>${asset.price ? money(asset.price) : "--"}</div>
        <div class="${asset.change >= 0 ? "positive" : "negative"}">
          ${asset.price ? (asset.change > 0 ? "+" : "") +
            asset.change.toFixed(2) + "%" : "--"}
        </div>
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".market-item").forEach(item => {
    item.addEventListener("click", async () => {
      selected = Number(item.dataset.index);
      renderMarkets();
      renderAnalysis();

      try {
        await loadCandles();
      } catch (error) {
        setStatus("Could not load candles. Check connection.");
      }
    });
  });
}

function renderAnalysis() {
  const asset = assets[selected];

  document.getElementById("selectedName").textContent =
    `${asset.name} (${asset.symbol})`;

  document.getElementById("selectedPrice").textContent =
    asset.price ? money(asset.price) : "--";

  const change = document.getElementById("selectedChange");

  change.textContent = asset.price
    ? `${asset.change > 0 ? "+" : ""}${asset.change.toFixed(2)}%`
    : "--";

  change.className = asset.change >= 0 ? "positive" : "negative";

  if (!candles.length) return;

  const closes = candles.map(c => c.close);

  document.getElementById("ema12").textContent =
    money(ema(closes, 12));

  document.getElementById("ema26").textContent =
    money(ema(closes, 26));

  document.getElementById("rsi").textContent =
    calculateRSI(closes).toFixed(1);

  drawChart(candles);
}

function renderAccount() {
  document.getElementById("balance").textContent = money(balance);
  document.getElementById("portfolio").textContent =
    money(portfolioValue());

  const count = Object.values(holdings)
    .filter(quantity => quantity > 0).length;

  document.getElementById("positions").textContent = count;
}

function renderHistory() {
  const area = document.getElementById("history");

  if (!history.length) {
    area.innerHTML = '<p class="muted">No simulated orders yet.</p>';
    return;
  }

  area.innerHTML = history.slice().reverse().map(item => `
    <div class="history-row">
      <span>${item.action} ${item.symbol}</span>
      <span>${money(item.amount)}</span>
    </div>
  `).join("");
}

function render() {
  renderMarkets();
  renderAnalysis();
  renderAccount();
  renderHistory();
}

function simulateOrder(action) {
  const asset = assets[selected];
  const amount = Number(document.getElementById("amount").value);
  const message = document.getElementById("tradeMessage");

  if (!asset.price) {
    message.textContent = "Wait for market prices to load.";
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    message.textContent = "Enter a valid virtual amount.";
    return;
  }

  const quantity = amount / asset.price;
  const currentQuantity = holdings[asset.symbol] || 0;

  if (action === "BUY") {
    if (amount > balance) {
      message.textContent = "Not enough virtual balance.";
      return;
    }

    balance -= amount;
    holdings[asset.symbol] = currentQuantity + quantity;
  } else {
    if (quantity > currentQuantity) {
      message.textContent = "Not enough virtual holdings to sell.";
      return;
    }

    balance += amount;
    holdings[asset.symbol] = currentQuantity - quantity;
  }

  history.push({
    action,
    symbol: asset.symbol,
    amount
  });

  message.textContent =
    `Virtual ${action.toLowerCase()} completed. No real order was placed.`;

  render();
}

async function refreshMarket() {
  try {
    await loadMarketPrices();
    await loadCandles();

    render();
    setStatus("Live public data · 15-minute candles");
  } catch (error) {
    console.error(error);
    setStatus("Market data unavailable · Check internet");
  }
}

document.getElementById("buyBtn").addEventListener("click", () => {
  simulateOrder("BUY");
});

document.getElementById("sellBtn").addEventListener("click", () => {
  simulateOrder("SELL");
});

document.getElementById("resetBtn").addEventListener("click", () => {
  balance = 10000;
  holdings = {};
  history = [];

  document.getElementById("tradeMessage").textContent =
    "Virtual demo account reset.";

  render();
});

window.addEventListener("resize", () => {
  drawChart(candles);
});

render();
refreshMarket();

setInterval(refreshMarket, 30000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .catch(error => console.error("Service worker error:", error));
  });
}
