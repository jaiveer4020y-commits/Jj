from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse, urljoin
import re
import ast
import json
import requests
from bs4 import BeautifulSoup

def to_base_36(n):
    return '' if n == 0 else to_base_36(n // 36) + "0123456789abcdefghijklmnopqrstuvwxyz"[n % 36]

def unpack(p, a, c, k):
    for i in range(c):
        if k[c - i - 1]:
            p = re.sub(r'\b' + to_base_36(c - i - 1) + r'\b', k[c - i - 1], p)
    return p

def extract_m3u8(embed_url):
    parsed_url = urlparse(embed_url)
    default_domain = f"{parsed_url.scheme}://{parsed_url.netloc}/"
    headers = {
        'Referer': default_domain,
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
    }

    try:
        response = requests.get(embed_url, headers=headers, timeout=10).text
        soup = BeautifulSoup(response, 'html.parser')
        
        js_code = next((script.string for script in soup.find_all('script') if script.string and "eval(function(p,a,c,k,e,d)" in script.string), "")
        if not js_code:
            return None

        encoded_packed = re.sub(r"eval\(function\([^\)]*\)\{[^\}]*\}\(|.split\('\|'\)\)\)", '', js_code)
        data = ast.literal_eval(encoded_packed)
        p, a, c, k = data[0], int(data[1]), int(data[2]), data[3].split('|')
        decoded_data = unpack(p, a, c, k)

        # Fix: Extract group(1) as a string, clean backslashes
        match = re.search(r'\"hls2\":"([^"]+)', decoded_data)
        if not match:
            return None
        master_m3u8 = match.group(1).replace('\\', '')

        playlist_response = requests.get(master_m3u8, headers=headers, timeout=10).text
        raw_m3u8_url = master_m3u8

        if "#EXT-X-STREAM-INF" in playlist_response:
            lines = playlist_response.splitlines()
            variants = [line.strip() for line in lines if line and not line.startswith("#")]
            if variants:
                raw_m3u8_url = urljoin(master_m3u8, variants[-1])

        return raw_m3u8_url
    except Exception as e:
        print("Python Exception:", str(e))
        return None

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        query_params = parse_qs(parsed_path.query)
        embed_url = query_params.get('url', [None])[0]

        if not embed_url:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Missing url"}).encode('utf-8'))
            return

        m3u8_url = extract_m3u8(embed_url)

        if m3u8_url:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"m3u8_url": m3u8_url}).encode('utf-8'))
        else:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Extraction failed"}).encode('utf-8'))
