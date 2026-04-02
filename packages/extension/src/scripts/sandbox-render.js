const loadingEl = document.getElementById("loading");
const contentEl = document.getElementById("content");

// Map to track pending requests and their source window.
const pendingRequests = new Map();

window.addEventListener("message", (event) => {
  const data = event.data;

  // Handle render message from parent (viewer).
  if (data?.type === "render" && typeof data.html === "string") {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
    contentEl.srcdoc = data.html;
    return;
  }

  // Relay FS/BASH requests from content iframe to parent (viewer).
  if (data?.type?.endsWith("_REQUEST") && event.source === contentEl.contentWindow) {
    pendingRequests.set(data.id, event.source);
    window.parent.postMessage(data, "*");
    return;
  }

  // Relay FS/BASH responses back to the content iframe.
  if (data?.type?.endsWith("_RESPONSE") && pendingRequests.has(data.id)) {
    const source = pendingRequests.get(data.id);
    pendingRequests.delete(data.id);
    source.postMessage(data, "*");
  }
});

// Notify parent that we're ready to receive content.
if (window.parent !== window) {
  window.parent.postMessage({ type: "sandbox-ready" }, "*");
}
