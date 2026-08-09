import json
import re
import ast
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse, urljoin, unquote
import requests
from bs4 import BeautifulSoup


def to_base_36(n):
    """Convert number to base 36"""
    if n == 0:
        return ''
    return to_base_36(n // 36) + "0123456789abcdefghijklmnopqrstuvwxyz"[n % 36]


def unpack(p, a, c, k):
    """Unpack packed JavaScript"""
    for i in range(c):
        if k[c - i - 1]:
            pattern = r'\b' + to_base_36(c - i - 1) + r'\b'
            p = re.sub(pattern, k[c - i - 1], p)
    return p


def extract_m3u8(embed_url):
    """Extract M3U8 URL from StreamHG/Hanerix embed page"""
    try:
        if not embed_url or len(embed_url.strip()) == 0:
            print("[ERROR] Empty embed URL provided")
            return None
        
        print(f"[START] Extracting M3U8 from embed: {embed_url}")
        
        # Setup headers
        parsed_url = urlparse(embed_url)
        default_domain = f"{parsed_url.scheme}://{parsed_url.netloc}/"
        
        headers = {
            'Referer': default_domain,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        print(f"[INFO] Using domain: {default_domain}")
        print(f"[INFO] Making request to: {embed_url}")
        
        # Step 1: Fetch embed page
        try:
            response = requests.get(embed_url, headers=headers, timeout=15)
            response.raise_for_status()
            html_content = response.text
            print(f"[SUCCESS] Fetched embed page ({len(html_content)} bytes)")
        except requests.exceptions.Timeout:
            print("[ERROR] Request timeout (>15s)")
            return None
        except requests.exceptions.ConnectionError:
            print("[ERROR] Connection error")
            return None
        except Exception as e:
            print(f"[ERROR] Failed to fetch embed page: {str(e)}")
            return None
        
        # Step 2: Parse HTML and find packed JS
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            print("[INFO] Parsed HTML with BeautifulSoup")
        except Exception as e:
            print(f"[ERROR] Failed to parse HTML: {str(e)}")
            return None
        
        # Step 3: Find script with packed code
        js_code = None
        script_count = 0
        for script in soup.find_all('script'):
            script_count += 1
            if script.string and "eval(function(p,a,c,k,e,d)" in script.string:
                js_code = script.string
                print(f"[SUCCESS] Found packed JS in script tag #{script_count}")
                break
        
        if not js_code:
            print(f"[ERROR] Packed JS not found (checked {script_count} script tags)")
            return None
        
        # Step 4: Extract packed data
        try:
            encoded_packed = re.sub(
                r"eval\(function\([^\)]*\)\{[^\}]*\}\(|\.split\('\|'\)\)?,",
                '',
                js_code
            )
            print(f"[INFO] Extracted packed data ({len(encoded_packed)} chars)")
        except Exception as e:
            print(f"[ERROR] Failed to extract packed data: {str(e)}")
            return None
        
        # Step 5: Parse packed data
        try:
            data = ast.literal_eval(encoded_packed)
            if not isinstance(data, (list, tuple)) or len(data) < 4:
                print("[ERROR] Invalid packed data format")
                return None
            
            p = data[0]
            a = int(data[1])
            c = int(data[2])
            k = data[3].split('|') if isinstance(data[3], str) else data[3]
            
            print(f"[INFO] Parsed packed data: p={len(p)}chars, a={a}, c={c}, k={len(k)}items")
        except Exception as e:
            print(f"[ERROR] Failed to parse packed data: {str(e)}")
            return None
        
        # Step 6: Unpack JavaScript
        try:
            decoded_data = unpack(p, a, c, k)
            print(f"[SUCCESS] Unpacked JavaScript ({len(decoded_data)} chars)")
        except Exception as e:
            print(f"[ERROR] Failed to unpack JavaScript: {str(e)}")
            return None
        
        # Step 7: Extract M3U8 URL from decoded data
        try:
            # Try multiple patterns
            match = re.search(r'\"hls2\":"([^"]+)', decoded_data)
            if not match:
                match = re.search(r'\"hls\":\"([^"]+)', decoded_data)
            if not match:
                match = re.search(r'\"m3u8\":\"([^"]+)', decoded_data)
            
            if not match:
                print("[ERROR] Could not find M3U8 URL in decoded data")
                print(f"[DEBUG] Decoded snippet: {decoded_data[:500]}")
                return None
            
            master_m3u8 = match.group(1).replace('\\', '')
            print(f"[SUCCESS] Extracted master M3U8 URL: {master_m3u8}")
        except Exception as e:
            print(f"[ERROR] Failed to extract M3U8 URL: {str(e)}")
            return None
        
        # Step 8: Fetch master playlist
        try:
            playlist_response = requests.get(master_m3u8, headers=headers, timeout=15)
            playlist_response.raise_for_status()
            playlist_content = playlist_response.text
            print(f"[SUCCESS] Fetched master playlist ({len(playlist_content)} bytes)")
        except Exception as e:
            print(f"[WARNING] Could not fetch master playlist: {str(e)}")
            print(f"[INFO] Returning master M3U8 as fallback: {master_m3u8}")
            return master_m3u8
        
        # Step 9: Extract best quality variant
        raw_m3u8_url = master_m3u8
        
        if "#EXT-X-STREAM-INF" in playlist_content:
            print("[INFO] Found variant playlist (multiple quality streams)")
            lines = playlist_content.splitlines()
            variants = [
                line.strip() 
                for line in lines 
                if line.strip() and not line.startswith("#")
            ]
            
            if variants:
                # Get last variant (usually highest quality)
                raw_m3u8_url = urljoin(master_m3u8, variants[-1])
                print(f"[SUCCESS] Using variant stream: {raw_m3u8_url}")
        else:
            print("[INFO] Single stream playlist (no variants)")
        
        print(f"[FINAL] M3U8 URL: {raw_m3u8_url}")
        return raw_m3u8_url
    
    except Exception as e:
        print(f"[FATAL] Unexpected error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return None


class handler(BaseHTTPRequestHandler):
    """Vercel serverless function handler"""
    
    def do_GET(self):
        """Handle GET requests"""
        try:
            print(f"\n{'='*60}")
            print(f"[REQUEST] {self.client_address[0]} {self.command} {self.path}")
            print(f"{'='*60}")
            
            # Parse query parameters
            parsed_path = urlparse(self.path)
            query_params = parse_qs(parsed_path.query)
            
            # Get embed URL
            embed_url = query_params.get('url', [None])[0]
            
            # Try to decode if encoded
            if embed_url:
                try:
                    decoded_url = unquote(embed_url)
                    if decoded_url != embed_url:
                        print(f"[INFO] URL was URL-encoded, decoded it")
                    embed_url = decoded_url
                except:
                    pass
            
            print(f"[PARAM] embed_url = {embed_url}")
            
            # Validate
            if not embed_url or len(embed_url.strip()) == 0:
                print("[ERROR] Missing or empty 'url' parameter")
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                response = json.dumps({
                    "error": "Missing 'url' query parameter",
                    "example": "/api/extract?url=https://hanerix.com/e/xyz"
                })
                self.wfile.write(response.encode('utf-8'))
                print(f"[RESPONSE] 400 - Missing parameter")
                return
            
            # Extract M3U8
            print("\n[PROCESSING] Starting M3U8 extraction...")
            m3u8_url = extract_m3u8(embed_url)
            
            # Send response
            if m3u8_url:
                print(f"\n[RESPONSE] 200 - Success")
                print(f"[RETURN] m3u8_url = {m3u8_url}")
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                response = json.dumps({"m3u8_url": m3u8_url})
                self.wfile.write(response.encode('utf-8'))
            else:
                print(f"\n[RESPONSE] 500 - Extraction failed")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                response = json.dumps({
                    "error": "Failed to extract M3U8 URL from embed page",
                    "embed_url": embed_url
                })
                self.wfile.write(response.encode('utf-8'))
        
        except Exception as e:
            print(f"\n[FATAL ERROR] {str(e)}")
            import traceback
            print(traceback.format_exc())
            
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = json.dumps({"error": str(e)})
            self.wfile.write(response.encode('utf-8'))
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        """Override default logging"""
        # Print to stdout for Vercel logs
        print(format % args)
