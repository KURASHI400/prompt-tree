export async function sha256(blob: Blob) {
  const bytes = await blob.arrayBuffer();
  if (typeof Worker === "undefined")
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  const worker = new Worker(new URL("./hash.worker.ts", import.meta.url), {
    type: "module",
  });
  try {
    return await new Promise<string>((resolve, reject) => {
      worker.onmessage = (e) =>
        e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.hash);
      worker.onerror = () => reject(new Error("画像の検証に失敗しました"));
      worker.postMessage(bytes, [bytes]);
    });
  } finally {
    worker.terminate();
  }
}
