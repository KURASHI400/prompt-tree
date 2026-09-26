self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const hash = await crypto.subtle.digest("SHA-256", event.data);
    self.postMessage({
      hash: [...new Uint8Array(hash)]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join(""),
    });
  } catch {
    self.postMessage({ error: "画像の検証に失敗しました" });
  }
};
export {};
