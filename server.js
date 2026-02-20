const https = require("https");
const http = require("http");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.PROXY_API_KEY;

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  }

  // Only accept POST /proxy/vsdc
  if (req.method !== "POST" || !req.url.startsWith("/proxy/vsdc")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Not found" }));
  }

  // Auth check
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (API_KEY && token !== API_KEY) {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Unauthorized" }));
  }

  // Read body
  let body = "";
  for await (const chunk of req) body += chunk;

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Invalid JSON" }));
  }

  const { targetUrl, pac, cert, key, caCerts, invoice } = payload;

  if (!targetUrl || !cert || !key || !invoice) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ error: "Missing required fields: targetUrl, cert, key, invoice" })
    );
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const invoiceBody = JSON.stringify(invoice);

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(invoiceBody),
        ...(pac ? { PAC: pac } : {}),
      },
      cert: cert,
      key: key,
      ca: caCerts && caCerts.length > 0 ? caCerts : undefined,
      rejectUnauthorized: true,
    };

    console.log(`[${new Date().toISOString()}] Proxying to ${targetUrl}`);

    const proxyReq = https.request(options, (proxyRes) => {
      let data = "";
      proxyRes.on("data", (chunk) => (data += chunk));
      proxyRes.on("end", () => {
        console.log(`[${new Date().toISOString()}] FRCS responded: ${proxyRes.statusCode}`);
        res.writeHead(proxyRes.statusCode, {
          "Content-Type": "application/json",
        });
        // Forward the raw FRCS response
        try {
          const parsed = JSON.parse(data);
          res.end(
            JSON.stringify({
              statusCode: proxyRes.statusCode,
              vsdcResponse: parsed,
            })
          );
        } catch {
          res.end(
            JSON.stringify({
              statusCode: proxyRes.statusCode,
              vsdcResponse: data,
            })
          );
        }
      });
    });

    proxyReq.on("error", (err) => {
      console.error(`[${new Date().toISOString()}] Proxy error:`, err.message);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Proxy request failed", details: err.message }));
    });

    proxyReq.write(invoiceBody);
    proxyReq.end();
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Server error:`, err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`V-SDC mTLS Proxy running on port ${PORT}`);
});
