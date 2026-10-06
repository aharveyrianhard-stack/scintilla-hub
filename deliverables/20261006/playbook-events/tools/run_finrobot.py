"""FinRobot (AI4Finance, Apache-2.0) Market_Analyst pattern from its own 'ollama function call' tutorial, pointed at the local
Qwen2.5-7B (llama.cpp). Only its keyless Yahoo tools are registered: its Finnhub / FMP / SEC-API tools need keys we do not hold here."""
import os, sys, json, time, traceback, warnings
warnings.filterwarnings("ignore"); os.environ["AUTOGEN_USE_DOCKER"] = "False"
S = os.path.dirname(os.path.abspath(__file__)); os.chdir(S + "/fr-out")
from autogen import AssistantAgent, UserProxyAgent
from finrobot.data_source import YFinanceUtils
from finrobot.toolkits import register_toolkits
llm_config = {"config_list": [{"model": "qwen2.5-7b-instruct", "base_url": "http://127.0.0.1:18093/v1", "api_key": "local"}], "timeout": 600, "temperature": 0.2, "cache_seed": None}
out = {}
for sym in sys.argv[1:]:
    t0 = time.time()
    try:
        analyst = AssistantAgent(name="Market_Analyst", llm_config=llm_config, system_message="You are a market analyst. Use the tools to fetch data, then write a concise technical and fundamental review of the instrument: conditions and numbers, no buy/sell verdict. Reply TERMINATE when done.")
        proxy = UserProxyAgent("user_proxy", code_execution_config=False, max_consecutive_auto_reply=4, human_input_mode="NEVER", is_termination_msg=lambda x: bool(x.get("content")) and "TERMINATE" in x.get("content", ""))
        tools = [{"function": YFinanceUtils.get_stock_data, "name": "get_stock_data", "description": "daily OHLCV for a ticker between two dates (YYYY-MM-DD)"},
                 {"function": YFinanceUtils.get_stock_info, "name": "get_stock_info", "description": "latest company profile and key financial figures for a ticker"}]
        register_toolkits(tools, analyst, proxy)
        chat = proxy.initiate_chat(analyst, message=f"Review {sym} as of 2026-10-05. Fetch the daily prices from 2026-07-01 to 2026-10-05 and the stock info, then write the review.", silent=True)
        msgs = chat.chat_history; tool_calls = sum(len(m.get("tool_calls") or []) for m in msgs); tool_results = [m for m in msgs if m.get("role") == "tool" or m.get("tool_responses")]
        final = [m.get("content") for m in msgs if m.get("name") == "Market_Analyst" or m.get("role") == "user" and m.get("content")]
        texts = [m.get("content") or "" for m in msgs if not m.get("tool_calls") and not m.get("tool_responses") and m.get("role") != "tool"]
        out[sym] = {"seconds": round(time.time() - t0, 1), "turns": len(msgs), "tool_calls": tool_calls, "tool_results": len(tool_results), "tool_result_chars": sum(len(str(m.get("content") or "")) for m in tool_results),
                    "tool_error": any("Error" in str(m.get("content") or "")[:300] for m in tool_results), "review": max(texts[1:], key=len) if len(texts) > 1 else ""}
    except Exception as e:
        out[sym] = {"seconds": round(time.time() - t0, 1), "error": repr(e)[:600], "trace": traceback.format_exc()[-1200:]}
    print(sym, {k: (v if k != "review" else v[:300]) for k, v in out[sym].items()}, flush=True)
    json.dump(out, open(S + "/fr-out/result.json", "w"), indent=1)
