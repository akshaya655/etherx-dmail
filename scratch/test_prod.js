const testDebug = async () => {
  const url = "https://dmail-backend-production.up.railway.app/api/smtp-debug";
  console.log(`Fetching diagnostic output from: ${url}...`);
  try {
    const res = await fetch(url);
    console.log(`Status: ${res.status} ${res.statusText}`);
    const json = await res.json();
    console.log("Diagnostic Results:", JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
};

testDebug();
