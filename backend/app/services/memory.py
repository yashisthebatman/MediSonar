import sqlite3
import json
from datetime import datetime, timezone


def _parse_iso_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed

class MemoryStore:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS user_facts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                fact TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cur.execute(
            '''
            CREATE TABLE IF NOT EXISTS advisories_cache (
                cache_key TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                fetched_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
        '''
        )
        conn.commit()
        conn.close()

    def get_context(self, user_id: str) -> str:
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute('SELECT fact FROM user_facts WHERE user_id = ? ORDER BY id ASC', (user_id,))
        rows = cur.fetchall()
        conn.close()
        
        if not rows:
            return "No prior context known."
        
        facts = [row[0] for row in rows]
        return "- " + "\n- ".join(facts)

    def save_fact(self, user_id: str, fact: str):
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute('INSERT INTO user_facts (user_id, fact) VALUES (?, ?)', (user_id, fact))
        conn.commit()
        conn.close()

    def _advisories_cache_key(self, location: str, conditions: str) -> str:
        return f"{location.strip().lower()}::{conditions.strip().lower()}"

    def get_advisories_cache(self, location: str, conditions: str):
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute(
            'SELECT payload, fetched_at, expires_at FROM advisories_cache WHERE cache_key = ?',
            (self._advisories_cache_key(location, conditions),),
        )
        row = cur.fetchone()
        conn.close()
        if not row:
            return None

        return {
            "payload": json.loads(row[0]),
            "fetched_at": _parse_iso_datetime(row[1]),
            "expires_at": _parse_iso_datetime(row[2]),
        }

    def save_advisories_cache(self, location: str, conditions: str, payload: list[dict], fetched_at: datetime, expires_at: datetime):
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute(
            '''
            INSERT INTO advisories_cache (cache_key, payload, fetched_at, expires_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET
                payload = excluded.payload,
                fetched_at = excluded.fetched_at,
                expires_at = excluded.expires_at
        ''',
            (
                self._advisories_cache_key(location, conditions),
                json.dumps(payload),
                fetched_at.isoformat(),
                expires_at.isoformat(),
            ),
        )
        conn.commit()
        conn.close()

    def reset(self, clear_memory: bool = True, clear_advisories_cache: bool = True) -> bool:
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cleared_any = False
        if clear_memory:
            cur.execute('DELETE FROM user_facts')
            cleared_any = True
        if clear_advisories_cache:
            cur.execute('DELETE FROM advisories_cache')
            cleared_any = True
        conn.commit()
        conn.close()
        return cleared_any

    def reset_all(self):
        self.reset(clear_memory=True, clear_advisories_cache=True)

    def extract_and_save_facts(self, user_id: str, user_message: str, client) -> list[str]:
        prompt = (
            f"Analyze this user message: '{user_message}'\n"
            "If the user shares personal facts such as symptoms, conditions, allergies, age, or preferences, "
            "extract them as a JSON list of strings. If there are no new personal facts, return an empty list []. "
            "Only return the raw JSON list format exactly. Do not include markdown ticks."
        )
        
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=prompt,
            )
            raw_text = response.text.strip()
            
            if raw_text.startswith("```json"):
                raw_text = raw_text.replace("```json", "", 1)
            raw_text = raw_text.replace("```", "").strip()
            
            facts = json.loads(raw_text)
            saved_facts = []
            
            if isinstance(facts, list):
                for fact in facts:
                    self.save_fact(user_id, fact)
                    saved_facts.append(fact)
            return saved_facts
        except Exception:
            return []
