"""Local development server. Runtime app remains entirely static."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import argparse

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4173)
    parser.add_argument('--bind', default='127.0.0.1')
    args = parser.parse_args()
    handler = partial(SimpleHTTPRequestHandler, directory=Path(__file__).resolve().parents[1])
    print(f'Pilot Path Flight: http://{args.bind}:{args.port}', flush=True)
    ThreadingHTTPServer((args.bind, args.port), handler).serve_forever()
