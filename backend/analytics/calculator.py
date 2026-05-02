import time
import numpy as np
import yfinance as yf

TRADING_DAYS_PER_YEAR = 252
ROLLING_WINDOW = 30
CACHE_TTL_SECONDS = 3600

_cache = {}

ETF_CURRENCY = {
    "CSPX.L": "GBP",
    "VUSA.L": "GBP",
    "ISF.L":  "GBP",
}

BENCHMARK_CURRENCY = {
    "^GSPC": "USD",
    "^FTSE": "GBP",
}


def _cache_key(etf_ticker, benchmark_ticker, period):
    return f"{etf_ticker}:{benchmark_ticker}:{period}"


def _is_cached(key):
    if key not in _cache:
        return False
    return time.time() - _cache[key]["ts"] < CACHE_TTL_SECONDS


def _fetch(ticker, period):
    raw = yf.download(ticker, period=period, auto_adjust=True, progress=False)
    if raw.empty:
        raise ValueError(f"No data returned for {ticker}")
    return raw["Close"].squeeze().dropna()


def _convert_to_common_currency(prices, from_currency, to_currency, period):
    if from_currency == to_currency:
        return prices
    pair = f"{from_currency}{to_currency}=X"
    fx_raw = yf.download(pair, period=period, auto_adjust=True, progress=False)
    if fx_raw.empty:
        raise ValueError(f"Could not fetch FX rate for {pair}")
    fx = fx_raw["Close"].squeeze().dropna()
    shared = prices.index.intersection(fx.index)
    if len(shared) < ROLLING_WINDOW:
        raise ValueError("Insufficient overlapping dates between price and FX series")
    prices = prices.loc[shared]
    fx = fx.loc[shared]
    if from_currency == "USD" and to_currency == "GBP":
        return prices / fx
    elif from_currency == "GBP" and to_currency == "USD":
        return prices * fx
    else:
        return prices / fx


def compute_analytics(etf_ticker: str, benchmark_ticker: str, period: str = "6mo") -> dict:
    key = _cache_key(etf_ticker, benchmark_ticker, period)
    if _is_cached(key):
        return _cache[key]["data"]

    etf_prices = _fetch(etf_ticker, period)
    idx_prices = _fetch(benchmark_ticker, period)

    etf_currency = ETF_CURRENCY.get(etf_ticker, "GBP")
    idx_currency = BENCHMARK_CURRENCY.get(benchmark_ticker, "USD")
    target_currency = etf_currency

    idx_prices = _convert_to_common_currency(
        idx_prices, idx_currency, target_currency, period
    )

    shared_dates = etf_prices.index.intersection(idx_prices.index)
    if len(shared_dates) < ROLLING_WINDOW + 5:
        raise ValueError("Insufficient overlapping trading days to compute analytics")

    etf_prices = etf_prices.loc[shared_dates]
    idx_prices = idx_prices.loc[shared_dates]

    etf_returns = etf_prices.pct_change().dropna()
    idx_returns = idx_prices.pct_change().dropna()

    shared_returns = etf_returns.index.intersection(idx_returns.index)
    etf_returns = etf_returns.loc[shared_returns]
    idx_returns = idx_returns.loc[shared_returns]

    daily_diff = etf_returns - idx_returns
    tracking_error = float(daily_diff.std() * np.sqrt(TRADING_DAYS_PER_YEAR) * 100)

    etf_cum = float((etf_prices.iloc[-1] / etf_prices.iloc[0] - 1) * 100)
    idx_cum = float((idx_prices.iloc[-1] / idx_prices.iloc[0] - 1) * 100)
    tracking_difference = round(etf_cum - idx_cum, 4)

    rolling_te = (
        daily_diff
        .rolling(ROLLING_WINDOW)
        .std()
        .mul(np.sqrt(TRADING_DAYS_PER_YEAR) * 100)
        .dropna()
    )

    dates = [d.strftime("%d %b") for d in etf_returns.index]
    etf_cum_series = ((etf_prices / etf_prices.iloc[0]) - 1).mul(100)
    idx_cum_series = ((idx_prices / idx_prices.iloc[0]) - 1).mul(100)

    rolling_te_full = [None] * (ROLLING_WINDOW - 1) + [
        round(v, 4) for v in rolling_te.values.tolist()
    ]

    result = {
        "tracking_error": round(tracking_error, 4),
        "tracking_difference": round(tracking_difference, 4),
        "etf_return": round(etf_cum, 4),
        "benchmark_return": round(idx_cum, 4),
        "period_days": len(shared_returns),
        "period_start": shared_returns[0].strftime("%Y-%m-%d"),
        "period_end": shared_returns[-1].strftime("%Y-%m-%d"),
        "fx_adjusted": etf_currency != idx_currency,
        "base_currency": target_currency,
        "chart": {
            "dates": dates,
            "etf_cumulative": [round(v, 4) for v in etf_cum_series.values.tolist()],
            "benchmark_cumulative": [round(v, 4) for v in idx_cum_series.values.tolist()],
            "rolling_tracking_error": rolling_te_full,
        },
    }

    _cache[key] = {"data": result, "ts": time.time()}
    return result
