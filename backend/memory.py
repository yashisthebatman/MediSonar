import sqlite3
import json

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
