// src/worker/sfDeployWorker/worker.ts
var cancelled = /* @__PURE__ */ new Set();
function post(msg) {
  self.postMessage(msg);
}
function normalizeInstanceUrl(instanceUrl) {
  const raw = String(instanceUrl || "").trim();
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}
function normalizeApiVersion(apiVersion) {
  const v = String(apiVersion || "").trim();
  return v || "63.0";
}
function formatSfError(status, payload) {
  const details = Array.isArray(payload) ? payload[0] : payload;
  const message = details?.message || details?.error || details?.error_description;
  const code = details?.errorCode || details?.error_code;
  const suffix = [code, message].filter(Boolean).join(": ");
  return `Salesforce API error (${status})${suffix ? ` - ${suffix}` : ""}`;
}
async function requestToolingJson(conn, method, toolingPath, body) {
  const instanceUrl = normalizeInstanceUrl(conn.instanceUrl);
  const apiVersion = normalizeApiVersion(conn.apiVersion);
  const token = String(conn.accessToken || "").trim();
  if (!instanceUrl || !token) throw new Error("Missing Salesforce connection.");
  const upstreamPath = toolingPath.startsWith("/services/data/") ? toolingPath : toolingPath.startsWith("/tooling/") ? `/services/data/v${apiVersion}${toolingPath}` : `/services/data/v${apiVersion}/tooling${toolingPath.startsWith("/") ? "" : "/"}${toolingPath}`;
  const upstreamUrl = `${instanceUrl}${upstreamPath}`;
  const url = `/proxy${upstreamPath}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Salesforceproxy-Endpoint": upstreamUrl,
      Authorization: `Bearer ${token}`,
      ...body != null ? { "Content-Type": "application/json" } : null
    },
    body: body != null ? JSON.stringify(body) : void 0
  });
  const text = await res.text();
  const json = text ? (() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })() : null;
  if (!res.ok) {
    throw new Error(formatSfError(res.status, json ?? text));
  }
  return { status: res.status, json, text };
}
async function requestToolingPatchSObject(conn, sobject, id, body) {
  return await requestToolingJson(
    conn,
    "PATCH",
    `/services/data/v${normalizeApiVersion(conn.apiVersion)}/tooling/sobjects/${encodeURIComponent(sobject)}/${encodeURIComponent(id)}`,
    body
  );
}
async function deployApexViaMetadataContainer(conn, item) {
  const apiVersion = normalizeApiVersion(conn.apiVersion);
  const ts = (Date.now() % 1e9).toString(36);
  const rnd = Math.random().toString(16).slice(2, 8);
  const containerName = `sfwb_${ts}_${rnd}`.slice(0, 32);
  const containerRes = await requestToolingJson(
    conn,
    "POST",
    `/services/data/v${apiVersion}/tooling/sobjects/MetadataContainer`,
    { Name: containerName }
  );
  const containerId = containerRes?.json?.id;
  if (!containerId) throw new Error("Failed to create MetadataContainer.");
  const memberSObject = item.sobject === "ApexClass" ? "ApexClassMember" : "ApexTriggerMember";
  await requestToolingJson(
    conn,
    "POST",
    `/services/data/v${apiVersion}/tooling/sobjects/${memberSObject}`,
    {
      MetadataContainerId: containerId,
      ContentEntityId: item.id,
      Body: item.text ?? ""
    }
  );
  const asyncRes = await requestToolingJson(
    conn,
    "POST",
    `/services/data/v${apiVersion}/tooling/sobjects/ContainerAsyncRequest`,
    {
      MetadataContainerId: containerId,
      IsCheckOnly: false
    }
  );
  const asyncId = asyncRes?.json?.id;
  if (!asyncId) throw new Error("Failed to create ContainerAsyncRequest.");
  const maxAttempts = 60;
  const delayMs = 500;
  let lastState = "";
  let lastError = "";
  for (let i = 0; i < maxAttempts; i++) {
    const statusRes = await requestToolingJson(
      conn,
      "GET",
      `/services/data/v${apiVersion}/tooling/sobjects/ContainerAsyncRequest/${encodeURIComponent(asyncId)}`
    );
    const st = String(statusRes?.json?.State || statusRes?.json?.state || "");
    lastState = st;
    lastError = String(statusRes?.json?.ErrorMsg || statusRes?.json?.errorMsg || "");
    const lower = st.toLowerCase();
    if (lower === "completed") break;
    if (lower === "failed") {
      throw new Error(lastError || "Apex deploy failed (ContainerAsyncRequest).");
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  if (String(lastState || "").toLowerCase() !== "completed") {
    throw new Error(`Apex deploy timed out (state=${lastState || "unknown"}).`);
  }
  try {
    await requestToolingJson(
      conn,
      "DELETE",
      `/services/data/v${apiVersion}/tooling/sobjects/MetadataContainer/${encodeURIComponent(containerId)}`
    );
  } catch {
  }
  return { status: 200 };
}
async function handleDeploy(requestId, connection, items) {
  const total = Array.isArray(items) ? items.length : 0;
  let done = 0;
  post({ type: "progress", requestId, done, total });
  for (const item of items) {
    if (cancelled.has(requestId)) break;
    post({ type: "progress", requestId, done, total, currentPath: item.path });
    try {
      if (item.sobject === "ApexClass" || item.sobject === "ApexTrigger") {
        const { status } = await deployApexViaMetadataContainer(connection, item);
        post({ type: "result", requestId, ok: true, path: item.path, sobject: item.sobject, id: item.id, status });
      } else {
        const payload = { [item.field]: item.text ?? "" };
        const { status } = await requestToolingPatchSObject(connection, item.sobject, item.id, payload);
        post({ type: "result", requestId, ok: true, path: item.path, sobject: item.sobject, id: item.id, status });
      }
    } catch (e) {
      const base = e?.message || String(e);
      post({
        type: "result",
        requestId,
        ok: false,
        path: item.path,
        sobject: item.sobject,
        id: item.id,
        error: `${item.sobject}/${item.id}: ${base}`
      });
    } finally {
      done += 1;
    }
  }
  post({ type: "progress", requestId, done, total });
  post({ type: "done", requestId });
  cancelled.delete(requestId);
}
self.onmessage = (ev) => {
  const msg = ev.data;
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "cancel") {
    cancelled.add(msg.requestId);
    return;
  }
  if (msg.type === "deploy") {
    void handleDeploy(msg.requestId, msg.connection, msg.items || []);
  }
};
//# sourceMappingURL=deploy.worker.js.map
