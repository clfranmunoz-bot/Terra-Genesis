import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8080

class RobustHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def handle(self):
        try:
            super().handle()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass

class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

def run_server():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    for p in range(PORT, PORT + 20):
        try:
            httpd = ThreadingServer(("", p), RobustHandler)
            url = f"http://localhost:{p}"
            print("=" * 60)
            print(f"  [TERRA GENESIS - SERVIDOR ROBUSTO MULTIHILO]")
            print(f"  Servidor activo en: {url}")
            print(f"  Presiona Ctrl+C para detener el servidor")
            print("=" * 60)
            sys.stdout.flush()
            try:
                webbrowser.open(url)
            except Exception:
                pass
            httpd.serve_forever()
            break
        except OSError:
            continue

if __name__ == "__main__":
    try:
        run_server()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        sys.exit(0)
