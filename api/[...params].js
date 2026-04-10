export default async function handler(req, res) {
  try {
    let params = req.query.params;
    if (!params) return safe(res, "Missing ID");

    if (!Array.isArray(params)) params = [params];

    const id = params[0];
    const season = params[1];
    const episode = params[2];

    const isSeries = season && episode;

    const base =
      "https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9";

    const url = isSeries
      ? `${base}/stream/series/${id}:${season}:${episode}.json`
      : `${base}/stream/movie/${id}.json`;

    let response;

    try {
      response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
    } catch (e) {
      return safe(res, "Fetch failed: " + e.message);
    }

    if (!response || !response.ok) {
      return safe(res, "Source error: " + response?.status);
    }

    let data;

    try {
      data = await response.json();
    } catch (e) {
      return safe(res, "Invalid JSON");
    }

    if (!data?.streams?.length) {
      return safe(res, "No streams found");
    }

    const streams = data.streams;

    // 🎯 FILTER CLEAN
    const hls = streams.filter(
      s => s?.url?.includes(".m3u8") && s?.name?.toLowerCase().includes("castle")
    );

    const fsl = streams.filter(
      s => s?.name?.toLowerCase().includes("fsl")
    );

    let finalStreams = hls.length ? hls : fsl;

    if (!finalStreams.length) {
      return safe(res, "No valid streams");
    }

    const formatted = finalStreams.map(s => ({
      quality: s.name.includes("1080") ? "1080p" : "720p",
      url: s.url
    }));

    // 🎬 PLAYER
    res.setHeader("Content-Type", "text/html");

    return res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/artplayer/dist/artplayer.css">
<style>
body { margin:0; background:black; }
#player { width:100vw; height:100vh; }
#loader {
  position:fixed; inset:0;
  display:flex; justify-content:center; align-items:center;
  background:black;
}
#loader img { width:60px; animation:spin 1s linear infinite; }
@keyframes spin { 100% { transform:rotate(360deg);} }
</style>
</head>
<body>

<div id="loader">
<img src="https://assets.nflxext.com/en_us/pages/wiplayer/site-spinner.png">
</div>

<div id="player"></div>

<script src="https://unpkg.com/artplayer/dist/artplayer.js"></script>

<script>
const streams = ${JSON.stringify(formatted)};

setTimeout(() => {
  document.getElementById("loader").remove();

  const art = new Artplayer({
    container: '#player',
    url: streams[0].url,
    autoplay: true,
    fullscreen: true
  });

  art.setting.add({
    html: 'Quality',
    selector: streams.map(s => ({
      html: s.quality,
      url: s.url
    })),
    onSelect: function(item) {
      art.switchUrl(item.url);
      return item.html;
    }
  });

}, 800);
</script>

</body>
</html>
`);

  } catch (err) {
    return safe(res, "Fatal crash: " + err.message);
  }

  // ✅ ALWAYS SAFE RESPONSE
  function safe(res, msg) {
    res.setHeader("Content-Type", "text/html");
    return res.send(`
<!DOCTYPE html>
<html>
<body style="background:black;color:white;font-family:sans-serif;padding:20px">
<h2>⚠️ ERROR</h2>
<p>${msg}</p>
</body>
</html>
`);
  }
}      });
    } catch (err) {
      clearTimeout(timeout);
      return debugPage(res, {
        error: "FETCH FAILED",
        message: err.message,
        url
      });
    }

    clearTimeout(timeout);

    if (!response) {
      return debugPage(res, {
        error: "NO RESPONSE OBJECT",
        url
      });
    }

    const status = response.status;

    try {
      rawText = await response.text();
    } catch (err) {
      return debugPage(res, {
        error: "FAILED TO READ RESPONSE",
        message: err.message,
        url,
        status
      });
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (err) {
      return debugPage(res, {
        error: "INVALID JSON",
        message: err.message,
        url,
        status,
        rawText: rawText.slice(0, 2000)
      });
    }

    if (!data || !Array.isArray(data.streams)) {
      return debugPage(res, {
        error: "INVALID STREAM STRUCTURE",
        url,
        status,
        data
      });
    }

    const streams = data.streams;

    if (!streams.length) {
      return debugPage(res, {
        error: "NO STREAMS FOUND",
        url,
        status
      });
    }

    // 🎯 FILTER
    const hls = streams.filter(
      (s) =>
        s?.url?.includes(".m3u8") &&
        s?.name?.toLowerCase().includes("castle")
    );

    const fsl = streams.filter(
      (s) =>
        s?.name?.toLowerCase().includes("fsl")
    );

    let finalStreams = hls.length ? hls : fsl;

    if (!finalStreams.length) {
      return debugPage(res, {
        error: "NO VALID STREAMS AFTER FILTER",
        url,
        status,
        totalStreams: streams.length
      });
    }

    const formatted = finalStreams.map((s) => ({
      quality: s.name.includes("1080") ? "1080p" : "720p",
      url: s.url,
      subtitles: s.subtitles || []
    }));

    // 🎬 PLAYER PAGE
    res.setHeader("Content-Type", "text/html");

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/artplayer/dist/artplayer.css">
<style>
body { margin:0; background:black; color:white; font-family:sans-serif; }
#player { width:100vw; height:100vh; }
#loader {
  position:fixed; inset:0;
  display:flex; justify-content:center; align-items:center;
  background:black; z-index:10;
}
#loader img { width:70px; animation:spin 1s linear infinite; }
@keyframes spin { 100% { transform:rotate(360deg);} }
</style>
</head>
<body>

<div id="loader">
<img src="https://assets.nflxext.com/en_us/pages/wiplayer/site-spinner.png">
</div>

<div id="player"></div>

<script src="https://unpkg.com/artplayer/dist/artplayer.js"></script>

<script>
const streams = ${JSON.stringify(formatted)};

setTimeout(() => {
  document.getElementById("loader").style.display = "none";

  const art = new Artplayer({
    container: '#player',
    url: streams[0].url,
    autoplay: true,
    fullscreen: true
  });

  art.setting.add({
    html: 'Quality',
    selector: streams.map(s => ({
      html: s.quality,
      url: s.url
    })),
    onSelect: function(item) {
      art.switchUrl(item.url);
      return item.html;
    }
  });

}, 1000);
</script>

</body>
</html>
`);
  } catch (err) {
    debugPage(res, {
      error: "FATAL CRASH",
      message: err.message
    });
  }

  function debugPage(res, info) {
    res.setHeader("Content-Type", "text/html");
    res.status(500).send(`
<!DOCTYPE html>
<html>
<body style="background:#111;color:#0f0;font-family:monospace;padding:20px">
<h2>⚠️ DEBUG ERROR</h2>
<pre>${JSON.stringify(info, null, 2)}</pre>
</body>
</html>
`);
  }
}
    let data;

    // 🛡️ SAFE JSON PARSE
    try {
      data = await response.json();
    } catch (err) {
      return res.status(500).send("Invalid JSON response");
    }

    if (!data || !Array.isArray(data.streams)) {
      return res.status(500).send("Invalid stream data");
    }

    const streams = data.streams;

    if (streams.length === 0) {
      return res.status(404).send("No streams available");
    }

    // 🎯 FILTER
    const hls = streams.filter(
      (s) =>
        s?.url?.includes(".m3u8") &&
        s?.name?.toLowerCase().includes("castle")
    );

    const fsl = streams.filter(
      (s) =>
        s?.name?.toLowerCase().includes("fsl")
    );

    let finalStreams = hls.length ? hls : fsl;

    if (!finalStreams.length) {
      return res.status(404).send("No valid streams");
    }

    const formatted = finalStreams.map((s) => ({
      quality: s.name.includes("1080") ? "1080p" : "720p",
      url: s.url,
      subtitles: s.subtitles || []
    }));

    const defaultStream = formatted[0];

    // ✅ JSON MODE
    if (req.headers.accept?.includes("application/json")) {
      return res.json({
        streams: formatted
      });
    }

    // 🎬 HTML PLAYER
    res.setHeader("Content-Type", "text/html");

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/artplayer/dist/artplayer.css">
<style>
body { margin:0; background:black; }
#player { width:100vw; height:100vh; }
#loader {
  position:fixed; inset:0;
  display:flex; justify-content:center; align-items:center;
  background:black; z-index:10;
}
#loader img { width:70px; animation:spin 1s linear infinite; }
@keyframes spin { 100% { transform:rotate(360deg);} }
</style>
</head>
<body>

<div id="loader">
<img src="https://assets.nflxext.com/en_us/pages/wiplayer/site-spinner.png">
</div>

<div id="player"></div>

<script src="https://unpkg.com/artplayer/dist/artplayer.js"></script>

<script>
const streams = ${JSON.stringify(formatted)};

setTimeout(() => {
  document.getElementById("loader").style.display = "none";

  const art = new Artplayer({
    container: '#player',
    url: streams[0].url,
    autoplay: true,
    fullscreen: true
  });

  art.setting.add({
    html: 'Quality',
    selector: streams.map(s => ({
      html: s.quality,
      url: s.url
    })),
    onSelect: function(item) {
      art.switchUrl(item.url);
      return item.html;
    }
  });

}, 1000);
</script>

</body>
</html>
`);
  } catch (err) {
    res.status(500).send("Crash: " + err.message);
  }
}
