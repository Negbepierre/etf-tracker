import os
import json
import boto3

AWS_REGION = os.getenv("AWS_REGION", "eu-west-2")
MODEL_ID = "eu.anthropic.claude-sonnet-4-5-20250929-v1:0"

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client("bedrock-runtime", region_name=AWS_REGION)
    return _client


SYSTEM_PROMPT = """You are an ETF product analyst writing client-ready performance commentary 
for a professional investment audience. Your output will appear in a dashboard used by 
sales teams and institutional clients.

Rules:
- Write exactly 3 sentences. No more, no less.
- Write in plain, professional English. No bullet points, no headers.
- Explain the tracking error figure in context — is it tight or elevated for this type of ETF?
- Identify the most likely cause of the tracking difference.
- If the tracking error is notably high, flag it clearly but without alarm.
- Never speculate about causes you cannot infer from the provided metrics.
- Do not mention that you are an AI or that this was generated automatically."""


def _build_prompt(metrics: dict) -> str:
    td = metrics["tracking_difference"]
    td_direction = "below" if td < 0 else "above"
    td_abs = abs(td)

    return f"""Write a 3-sentence performance commentary for the following ETF analytics report.

ETF: {metrics["etf_name"]}
Benchmark: {metrics["benchmark_name"]}
Period: {metrics["period_days"]} trading days
TER: {metrics["ter"]}%

Key metrics (derived statistics — no raw holdings data):
- Annualised tracking error: {metrics["tracking_error"]}%
- Tracking difference: {td}% ({td_abs:.2f}% {td_direction} benchmark)
- ETF total return: {metrics["etf_return"]}%
- Benchmark total return: {metrics["benchmark_return"]}%

Write the commentary now:"""


def generate_commentary(metrics: dict) -> str:
    """
    Sends only derived analytics metrics to Bedrock.
    Raw price data, holdings, and client information never leave the backend.
    AWS Bedrock guarantees zero data retention and no model training on inputs.
    """
    client = _get_client()

    response = client.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 300,
            "system": SYSTEM_PROMPT,
            "messages": [
                {"role": "user", "content": _build_prompt(metrics)}
            ],
        }),
    )

    body = json.loads(response["body"].read())
    return body["content"][0]["text"].strip()