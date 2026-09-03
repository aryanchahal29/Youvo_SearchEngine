const key = "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";

async function test() {
  console.log("Fetching...");
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query: "test" })
    });
    console.log("Status:", res.status);
    const data = await res.text();
    console.log("Data:", data.substring(0, 200));
  } catch(e) {
    console.error(e);
  }
}
test();
