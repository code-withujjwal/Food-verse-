"""Small in-memory sliding-window rate limiter for the expensive AI endpoints.

Limitation: state lives in this process only. With several worker processes each
worker keeps its own counts, so the effective limit is multiplied by the worker
count. That is acceptable for a single-process demo deployment.
"""
import threading
import time
from collections import defaultdict, deque

MAX_TRACKED_CLIENTS = 5000


class RateLimiter:
    def __init__(self, limit, window_seconds=60, clock=time.monotonic):
        self.limit = limit
        self.window = window_seconds
        self.clock = clock
        self._hits = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key):
        """Record a hit. Returns (allowed, retry_after_seconds)."""
        if self.limit <= 0:  # 0 disables limiting
            return True, 0
        now = self.clock()
        with self._lock:
            if len(self._hits) > MAX_TRACKED_CLIENTS:
                self._prune(now)
            hits = self._hits[key]
            while hits and now - hits[0] >= self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return False, max(1, int(self.window - (now - hits[0])) + 1)
            hits.append(now)
            return True, 0

    def _prune(self, now):
        for key in [k for k, h in self._hits.items() if not h or now - h[-1] >= self.window]:
            del self._hits[key]
