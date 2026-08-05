from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse, urljoin, unquote
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
    """Extract M3U8 URL from StreamHG/Hanerix embed page"""
    if not embed_url:
        print("[ERROR] No embed URL provided")
        return None
    
    print(f"[INFO] Extracting M3U8 from: {embed_url}")
    
    parsed_url = urlparse(embed_url)
    default_domain = f"{parsed_url.scheme}://{parsed_url.netloc}/"
    headers = {
        'Referer': default_domain,
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36'
    }

    try:
        # Fetch the embed page
        response = requests.get(embed_url, headers=headers, timeout=10)
        response.raise_for_status()
        html_content = response.text
        
        print("[INFO] Fetched embed page successfully")
        
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Find the script containing packed JavaScript
        js_code = None
        for script in soup.find_all('script'):
            if script.string and "eval(function(p,a,c,k,e,d)" in script.string:
                js_code = script.string
                break
        
        if not js_code:
            print("[ERROR] Could not find packed JavaScript in embed page")
            return None

        print("[INFO] Found packed JavaScript, attempting to unpack...")
        
        # Extract the packed data
        encoded_packed = re.sub(r"eval\(function\([^\)]*\)\{[^\}]*\}\(|.split\('\|'\)\)\)", '', js_code)
        
        try:
            data = ast.literal_eval(encoded_packed)
        except:
            print("[ERROR] Failed to parse packed data")
            return None
        
        p, a, c, k = data[0], int(data[1]), int(data[2]), data[3].split('|')
        decoded_data = unpack(p, a, c, k)
        
        print("[INFO] Successfully unpacked JavaScript")

        # Extract M3U8 URL from decoded data
        match = re.search(r'\"hls2\":"([^"]+)', decoded_data)
        if not match:
            print("[ERROR] Could not find hls2 URL in decoded data")
            return None
        
        master_m3u8 = match.group(1).replace('\\', '')
        print(f"[INFO] Found master M3U8: {master_m3u8}")

        # Fetch the master playlist
        try:
            playlist_response = requests.get(master_m3u8, headers=headers, timeout=10)
            playlist_response.raise_for_status()
            playlist_content = playlist_response.text
        except Exception as e:
            print(f"[WARNING] Could not fetch master playlist: {e}")
            return master_m3u8

        raw_m3u8_url = master_m3u8

        # If it's a variant playlist, get the best quality stream
        if "#EXT-X-STREAM-INF" in playlist_content:
            lines = playlist_content.splitlines()
            variants = [line.strip() for line in lines if line and not line.startswith("#")]
            if variants:
                # Get the last (usually best quality) variant
                raw_m3u8_url = urljoin(master_m3u8, variants[-1])
                print(f"[INFO] Found variant stream: {raw_m3u8_url}")

        print(f"[SUCCESS] Final M3U8 URL: {raw_m3u8_url}")
        return raw_m3u8_url
        
    except requests.exceptions.Timeout:
        print("[ERROR] Request timeout while fetching embed page")
        return None
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Request failed: {str(e)}")
        return None
    except Exception as e:
        print(f"[ERROR] Unexpected error: {str(e)}")
        return None

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET request to extract M3U8 URL"""
        parsed_path = urlparse(self.path)
        query_params = parse_qs(parsed_path.query)
        
        # Get the embed URL from query parameters
        embed_url = query_params.get('url', [None])[0]
        
        # Decode if it was URL encoded
        if embed_url:
            embed_url = unquote(embed_url)

        if not embed_url:
            print("[ERROR] Missing URL parameter")
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Missing url parameter"}).encode('utf-8'))
            return

        print(f"\n[REQUEST] Extract M3U8 from: {embed_url}")
        
        # Extract M3U8 URL
        m3u8_url = extract_m3u8(embed_url)

        if m3u8_url:
            print(f"[RESPONSE] Success: {m3u8_url}")
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"m3u8_url": m3u8_url}).encode('utf-8'))
        else:
            print("[RESPONSE] Extraction failed")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Extraction failed"}).encode('utf-8'))

    def log_message(self, format, *args):
        """Override to use print instead of stderr"""
        print(format % args)
