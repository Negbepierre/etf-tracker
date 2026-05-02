import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from analytics.calculator import compute_analytics
from analytics.bedrock import generate_commentary

load_dotenv()

app = Flask(__name__)
CORS(app, origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")])

ETF_CONFIG = {
    "CSPX": {
        "name": "iShares Core S&P 500 UCITS ETF",
        "ticker": "CSPX.L",
        "benchmark": "^GSPC",
        "benchmark_name": "S&P 500",
        "ter": 0.07,
    },
    "VUSA": {
        "name": "Vanguard S&P 500 UCITS ETF",
        "ticker": "VUSA.L",
        "benchmark": "^GSPC",
        "benchmark_name": "S&P 500",
        "ter": 0.07,
    },
    "ISF": {
        "name": "iShares Core FTSE 100 UCITS ETF",
        "ticker": "ISF.L",
        "benchmark": "^FTSE",
        "benchmark_name": "FTSE 100",
        "ter": 0.07,
    },
}


@app.route("/api/etfs", methods=["GET"])
def list_etfs():
    return jsonify(
        [
            {"id": k, "name": v["name"], "benchmark": v["benchmark_name"], "ter": v["ter"]}
            for k, v in ETF_CONFIG.items()
        ]
    )


@app.route("/api/analytics", methods=["POST"])
def analytics():
    body = request.get_json()
    etf_id = body.get("etf_id", "CSPX")
    period = body.get("period", "6mo")

    if etf_id not in ETF_CONFIG:
        return jsonify({"error": f"Unknown ETF: {etf_id}"}), 400

    cfg = ETF_CONFIG[etf_id]

    try:
        result = compute_analytics(
            etf_ticker=cfg["ticker"],
            benchmark_ticker=cfg["benchmark"],
            period=period,
        )
        result["etf_id"] = etf_id
        result["etf_name"] = cfg["name"]
        result["benchmark_name"] = cfg["benchmark_name"]
        result["ter"] = cfg["ter"]
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/commentary", methods=["POST"])
def commentary():
    body = request.get_json()

    required = ["etf_name", "benchmark_name", "tracking_error", "tracking_difference",
                "etf_return", "benchmark_return", "period_days", "ter"]

    missing = [f for f in required if f not in body]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    try:
        text = generate_commentary(metrics=body)
        return jsonify({"commentary": text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, port=5002)