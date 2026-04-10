export default async function handler(req, res) {
  try {
    let params = req.query.params;
    if (!params) return res.status(400).send("Missing ID");

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

    // ⏱️ FETCH WITH TIMEOUT (VERY IMPORTANT)
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });
    } catch (err) {
      return res.status(500).send("Fetch failed");
    }

    if (!response || !response.ok) {
      return res.status(500).send("Source not responding");
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
