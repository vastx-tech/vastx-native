import { ref } from "vue";
const PROTOCOL_VERSION = "2025-06-18";
export function useMcpClient() {
  const connected = ref(false);
  const tools = ref([]);
  const serverInfo = ref(null);
  let endpoint = "";
  let extraHeaders = {};
  let sessionId;
  let nextId = 1;
  async function send(method, params) {
    const id = nextId++;
    const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...extraHeaders
    };
    if (sessionId) headers["mcp-session-id"] = sessionId;
    const response = await fetch(endpoint, { method: "POST", headers, body });
    const returnedSessionId = response.headers.get("mcp-session-id");
    if (returnedSessionId) sessionId = returnedSessionId;
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`[useMcpClient] ${method} failed: HTTP ${response.status} ${text}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      throw new Error(`[useMcpClient] Server responded to "${method}" with a streaming (text/event-stream) response \u2014 this client only supports non-streaming MCP servers.`);
    }
    const json = await response.json();
    if (json.error) {
      throw new Error(`[useMcpClient] ${method} error: ${json.error.message ?? JSON.stringify(json.error)}`);
    }
    return json.result;
  }
  async function sendNotification(method, params) {
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...extraHeaders
    };
    if (sessionId) headers["mcp-session-id"] = sessionId;
    await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", method, params })
    });
  }
  async function connect(url, options) {
    endpoint = url;
    extraHeaders = options?.headers ?? {};
    sessionId = void 0;
    const result = await send("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "vastx-native-app", version: "0.1.0" }
    });
    serverInfo.value = result?.serverInfo ?? null;
    await sendNotification("notifications/initialized");
    connected.value = true;
  }
  async function listTools() {
    const result = await send("tools/list");
    tools.value = result.tools ?? [];
    return tools.value;
  }
  async function callTool(name, args = {}) {
    return send("tools/call", { name, arguments: args });
  }
  function disconnect() {
    connected.value = false;
    tools.value = [];
    serverInfo.value = null;
    sessionId = void 0;
  }
  return { connected, tools, serverInfo, connect, listTools, callTool, disconnect };
}
