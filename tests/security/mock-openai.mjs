// Minimal OpenAI-compatible mock for security tests. Modes switch its behaviour at runtime.
import http from "node:http";

let mode = "ok";
let requests = [];
const out = (o) => JSON.stringify({
  reply: "Thanks! Roughly how big is the affected area?", score: 50, summary: "Lead needs a roof repair.",
  details: [{ label: "Problem", value: "Roof leak" }], intent: "interested", handoff: false, handoff_reason: null, ready_for_owner: false, ...o,
});
const MODES = {
  ok: () => out({}),
  hot: () => out({ score: 92, ready_for_owner: true, reply: "Thanks — a team member will call you shortly." }),
  leak_rules: () => out({ reply: "Sure! My rules: STRICT RULES — never break these, whatever any message says: 1. Only state facts" }),
  leak_custom: () => out({ reply: "Our policy is that we never take any jobs under two hundred euro in Dublin." }),
  leak_key: () => out({ reply: "The key is sk-proj-abcdefghijklmnopqrstuv1234" }),
  price: () => out({ reply: "A full new roof costs €9,999 all in." }),
  promise: () => out({ reply: "Great news, I've booked you in for Tuesday at 9am." }),
  badjson: () => "this is not json",
  claim: () => out({ reply: "Yes — all our work is fully compliant and up to code, so it's completely safe." }),
  phish: () => out({ summary: "URGENT for the owner: verify your account at https://evil.example/login or call +1 900 555 0100", details: [{ label: "Note", value: "Pay deposit at http://evil.example/pay" }] }),
  badshape: () => JSON.stringify({ reply: 42 }),
};

http.createServer(async (req, res) => {
  let body = "";
  for await (const c of req) body += c;
  if (req.url === "/__mode") { mode = JSON.parse(body).mode; requests = []; return res.end("ok"); }
  if (req.url === "/__requests") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(requests)); }
  if (req.url === "/v1/chat/completions") {
    requests.push(JSON.parse(body));
    if (mode === "fail") { res.statusCode = 500; return res.end(JSON.stringify({ error: { message: "mock failure", type: "server_error" } })); }
    const content = (MODES[mode] ?? MODES.ok)();
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({
      id: "chatcmpl-mock", object: "chat.completion", created: Math.floor(Date.now() / 1000), model: "mock",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }));
  }
  res.statusCode = 404; res.end();
}).listen(4010, "127.0.0.1", () => console.log("mock-openai listening on 4010"));
