"""TradingAgents (TauricResearch, Apache-2.0) driven by the local Qwen2.5-7B on llama.cpp. No paid API.
Its analysts fetch their own data: prices/indicators/news from Yahoo (keyless), statements from SEC EDGAR."""
import os, sys, json, time, traceback
S = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("TRADINGAGENTS_RESULTS_DIR", S + "/ta-out/logs"); os.environ.setdefault("TRADINGAGENTS_CACHE_DIR", S + "/ta-out/cache"); os.environ.setdefault("TRADINGAGENTS_MEMORY_LOG_PATH", S + "/ta-out/memory.md")
from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph
cfg = DEFAULT_CONFIG.copy()
cfg.update({"llm_provider": "openai_compatible", "backend_url": "http://127.0.0.1:18092/v1", "deep_think_llm": "qwen2.5-7b-instruct", "quick_think_llm": "qwen2.5-7b-instruct",
            "max_debate_rounds": 1, "max_risk_discuss_rounds": 1, "max_tool_rounds": 4, "temperature": 0.2, "max_tokens": 900, "news_article_limit": 6, "global_news_article_limit": 4})
out = {}
for sym in sys.argv[1:]:
    t0 = time.time()
    try:
        analysts = ("market", "news") if sym in ("SPY", "XLV") else ("market", "news", "fundamentals")
        ta = TradingAgentsGraph(debug=False, config=cfg, selected_analysts=analysts)
        state, decision = ta.propagate(sym, "2026-10-05")
        keep = {k: state.get(k) for k in ("market_report", "news_report", "fundamentals_report", "investment_plan", "trader_investment_plan", "final_trade_decision")}
        out[sym] = {"seconds": round(time.time() - t0, 1), "decision": str(decision), "analysts": analysts, **{k: (v if isinstance(v, str) else json.dumps(v, default=str)) for k, v in keep.items()}}
    except Exception as e:
        out[sym] = {"seconds": round(time.time() - t0, 1), "error": repr(e)[:800], "trace": traceback.format_exc()[-1500:]}
    print(sym, out[sym].get("seconds"), out[sym].get("decision") or out[sym].get("error"), flush=True)
    json.dump(out, open(S + f"/ta-out/result-{'-'.join(sys.argv[1:])}.json", "w"), indent=1)
