const API = "https://api.binance.com/api/v3";

const assets = [
  { name: "Bitcoin", symbol: "BTC", pair: "BTCUSDT", price: 0, change: 0 },
  { name: "Ethereum", symbol: "ETH", pair: "ETHUSDT", price: 0, change: 0 },
  { name: "BNB", symbol: "BNB", pair: "BNBUSDT", price: 0, change: 0 },
  { name: "Solana", symbol: "SOL", pair: "SOLUSDT", price: 0, change: 0 }
];

let selected = 0;
let interval = "15m";
let balance = 10000;
let holdings = {};
let history = [];
let candles = [];
let requestId = 0;
let chart = null;
let candleSeries = null;
let ema12Series = null;
let ema26Series = null;
let refreshing = false;

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
  const status = document.getElementById("marketStatus");
  if (status) status.textContent = message;
}

function initializeChart() {
  const container = document.getElementById("priceChart");

  if (!window.LightweightCharts) {
    document.getElementById("chartMessage").textContent =
      "Chart library could not load. Check your internet connection.";
    return;
  }

  chart = LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: 340,

    layout: {
      background: {
        type: "solid",
        color: "#111a2b"
      },
      textColor: "#91a0b8",
      attributionLogo: true
    },

    grid: {
      vertLines: { color: "#26334a" },
      horzLines: { color: "#26334a" }
    },

    rightPriceScale: {
      borderColor: "#26334a"
    },

    timeScale: {
      borderColor: "#26334a",
      timeVisible: true,
      secondsVisible: false
    },

    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal
    },

    handleScroll: true,
    handleScale: true
  });

  candleSeries = chart.addSeries(
    LightweightCharts.CandlestickSeries,
    {
      upColor: "#27d69b",
      downColor: "#ff6577",
      borderVisible: false,
      wickUpColor: "#27d69b",
      wickDownColor: "#ff6577"
    }
  );

  ema12Series = chart.addSeries(
    LightweightCharts.LineSeries,
    {
      color: "#6b8cff",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      title: "EMA 12"
    }
  );

  ema26Series = chart.addSeries(
    LightweightCharts.LineSeries,
    {
      color: "#f2bd55",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      title: "EMA 26"
    }
  );

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      if (width > 0 && chart) {
        chart.applyOptions({ width });
      }
    });

    observer.observe(container);
  } else {
    window.addEventListener("resize", () => {
      if (chart) {
        chart.applyOptions({
          width: container.clientWidth
        });
      }
    });
  }
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
    const asset = assets.find(
      item => item.symbol === result.symbol
    );

    asset.price = result.price;
    asset.change = result.change;
  });
}

async function loadCandles() {
  const currentRequest = ++requestId;
  const asset = assets[selected];
  const selectedInterval = interval;

  const data = await getJSON(
    `${API}/klines?symbol=${asset.pair}` +
    `&interval=${selectedInterval}&limit=100`
  );

  if (
    currentRequest !== requestId ||
    selectedInterval !== interval
  ) return;

  candles = data.map(item => ({
    time: Math.floor(Number(item[0]) / 1000),
    open: Number(item[1]),
    high: Number(item[2]),
    low: Number(item[3]),
    close: Number(item[4])
  }));

  renderAnalysis();
}

function ema(values, period) {
  if (!values.length) return [];

  const multiplier = 2 / (period + 1);
  let previous = values[0];

  return values.map((value, index) => {
    if (index > 0) {
      previous =
        value * multiplier +
        previous * (1 - multiplier);
    }

    return previous;
  });
}

function calculateRSI(values, period = 14) {
  if (values.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (
    let i = values.length - period;
    i < values.length;
    i++
  ) {
    const difference = values[i] - values[i - 1];

    if (difference > 0) gains += difference;
    else losses -= difference;
  }

  const averageGain = gains / period;
  const averageLoss = losses / period;

  if (averageLoss === 0) {
    return averageGain === 0 ? 50 : 100;
  }

  const relativeStrength = averageGain / averageLoss;

  return 100 - (100 / (1 + relativeStrength));
}

function updateIndicatorVisibility() {
  if (!ema12Series || !ema26Series) return;

  ema12Series.applyOptions({
    visible: document.getElementById("ema12Toggle").checked
  });

  ema26Series.applyOptions({
    visible: document.getElementById("ema26Toggle").checked
  });
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
          ${asset.price
            ? (asset.change > 0 ? "+" : "") +
              asset.change.toFixed(2) + "%"
            : "--"}
        </div>
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".market-item").forEach(item => {
    item.addEventListener("click", async () => {
      selected = Number(item.dataset.index);
      candles = [];

      renderMarkets();
      renderAnalysis();

      try {
        await loadCandles();
        setStatus("Public market data loaded");
      } catch (error) {
        console.error(error);
        setStatus("Could not load selected chart");
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

  change.className =
    asset.change >= 0 ? "positive" : "negative";

  if (!candles.length || !candleSeries) return;

  const closes = candles.map(candle => candle.close);

  const ema12Values = ema(closes, 12);
  const ema26Values = ema(closes, 26);

  candleSeries.setData(candles);

  ema12Series.setData(
    candles.map((candle, index) => ({
      time: candle.time,
      value: ema12Values[index]
    }))
  );

  ema26Series.setData(
    candles.map((candle, index) => ({
      time: candle.time,
      value: ema26Values[index]
    }))
  );

  document.getElementById("ema12").textContent =
    money(ema12Values[ema12Values.length - 1]);

  document.getElementById("ema26").textContent =
    money(ema26Values[ema26Values.length - 1]);

  const rsi = calculateRSI(closes);

  document.getElementById("rsi").textContent =
    rsi === null ? "--" : rsi.toFixed(1);

  updateIndicatorVisibility();

  document.getElementById("chartMessage").textContent = "";

  chart.timeScale().fitContent();
}

function portfolioValue() {
  let total = balance;

  assets.forEach(asset => {
    total += (holdings[asset.symbol] || 0) * asset.price;
  });

  return total;
}

function renderAccount() {
  document.getElementById("balance").textContent =
    money(balance);

  document.getElementById("portfolio").textContent =
    money(portfolioValue());

  const count = Object.values(holdings)
    .filter(quantity => quantity > 0).length;

  document.getElementById("positions").textContent = count;
}

function renderHistory() {
  const area = document.getElementById("history");

  if (!history.length) {
    area.innerHTML =
      '<p class="muted">No simulated orders yet.</p>';
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
  const amount = Number(
    document.getElementById("amount").value
  );

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
      message.textContent =
        "Not enough virtual holdings to sell.";
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
  if (refreshing) return;

  refreshing = true;

  try {
    await loadMarketPrices();
    await loadCandles();

    renderMarkets();
    renderAccount();

    setStatus(
      `Public data · ${interval} candles · Updated ${new Date().toLocaleTimeString()}`
    );
  } catch (error) {
    console.error(error);
    setStatus("Market data unavailable · Check connection");
  } finally {
    refreshing = false;
  }
}

// Chart timeframe controls
document.querySelectorAll(".time-btn").forEach(button => {
  button.addEventListener("click", async () => {
    interval = button.dataset.interval;

    document.querySelectorAll(".time-btn").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    document.getElementById("chartMessage").textContent =
      "Loading selected timeframe...";

    try {
      await loadCandles();
      setStatus(`Public data · ${interval} candles`);
    } catch (error) {
      console.error(error);
      document.getElementById("chartMessage").textContent =
        "Could not load this timeframe. Try again.";
    }
  });
});

document.getElementById("ema12Toggle").addEventListener(
  "change",
  updateIndicatorVisibility
);

document.getElementById("ema26Toggle").addEventListener(
  "change",
  updateIndicatorVisibility
);

document.getElementById("buyBtn").addEventListener(
  "click",
  () => simulateOrder("BUY")
);

document.getElementById("sellBtn").addEventListener(
  "click",
  () => simulateOrder("SELL")
);

document.getElementById("resetBtn").addEventListener(
  "click",
  () => {
    balance = 10000;
    holdings = {};
    history = [];

    document.getElementById("tradeMessage").textContent =
      "Virtual demo account reset.";

    render();
  }
);

// Start the app
initializeChart();
render();
refreshMarket();

setInterval(refreshMarket, 30000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .catch(error => console.error(
        "Service worker error:",
        error
      ));
  });
}
