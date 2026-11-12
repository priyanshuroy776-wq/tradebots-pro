const assets = [
  { name: "Bitcoin", symbol: "BTC", price: 67500, change: 1.25 },
  { name: "Ethereum", symbol: "ETH", price: 3450, change: 0.82 },
  { name: "BNB", symbol: "BNB", price: 590, change: -0.45 },
  { name: "Solana", symbol: "SOL", price: 165, change: 2.10 }
];

let selected = 0;
let balance = 10000;
let holdings = {};
let history = [];

const money = value =>
  "$" + value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

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
        <div>${money(asset.price)}</div>
        <div class="${asset.change >= 0 ? "positive" : "negative"}">
          ${asset.change > 0 ? "+" : ""}${asset.change}%
        </div>
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".market-item").forEach(item => {
    item.addEventListener("click", () => {
      selected = Number(item.dataset.index);
      render();
    });
  });
}

function makePrices(asset) {
  const prices = [];
  let value = asset.price * 0.96;

  for (let i = 0; i < 40; i++) {
    value += (Math.random() - 0.46) * asset.price * 0.006;
    prices.push(value);
  }

  prices[prices.length - 1] = asset.price;
  return prices;
}

function ema(values, period) {
  const multiplier = 2 / (period + 1);
  let result = values[0];

  for (let i = 1; i < values.length; i++) {
    result = values[i] * multiplier + result * (1 - multiplier);
  }

  return result;
}

function calculateRSI(values) {
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < values.length; i++) {
    const difference = values[i] - values[i - 1];

    if (difference > 0) gains += difference;
    else losses -= difference;
  }

  if (losses === 0) return 100;

  const averageGain = gains / (values.length - 1);
  const averageLoss = losses / (values.length - 1);
  return 100 - (100 / (1 + averageGain / averageLoss));
}

function drawChart(values) {
  const canvas = document.getElementById("priceChart");
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;

  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;

  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);

  const width = rect.width;
  const height = rect.height;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "#26334a";
  ctx.lineWidth = 1;

  for (let i = 1; i <= 4; i++) {
    const y = (height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.beginPath();

  values.forEach((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 20) - 10;

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = "#6b8cff";
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function portfolioValue() {
  let total = balance;

  assets.forEach(asset => {
    total += (holdings[asset.symbol] || 0) * asset.price;
  });

  return total;
}

function renderAccount() {
  document.getElementById("balance").textContent = money(balance);
  document.getElementById("portfolio").textContent = money(portfolioValue());

  const count = Object.values(holdings).filter(qty => qty > 0).length;
  document.getElementById("positions").textContent = count;
}

function renderAnalysis() {
  const asset = assets[selected];
  const values = makePrices(asset);

  document.getElementById("selectedName").textContent =
    `${asset.name} (${asset.symbol})`;

  document.getElementById("selectedPrice").textContent = money(asset.price);

  const change = document.getElementById("selectedChange");
  change.textContent = `${asset.change > 0 ? "+" : ""}${asset.change}%`;
  change.className = asset.change >= 0 ? "positive" : "negative";

  document.getElementById("ema12").textContent = money(ema(values, 12));
  document.getElementById("ema26").textContent = money(ema(values, 26));
  document.getElementById("rsi").textContent =
    calculateRSI(values).toFixed(1);

  drawChart(values);
}

function renderHistory() {
  const area = document.getElementById("history");

  if (history.length === 0) {
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
    `Simulated ${action.toLowerCase()} completed. No real order was placed.`;

  render();
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
    "Demo account reset.";

  render();
  if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then(() => console.log("TradeBots Pro app ready"))
      .catch(error => console.error("App setup error:", error));
  });
  }
});

window.addEventListener("resize", renderAnalysis);

render();
