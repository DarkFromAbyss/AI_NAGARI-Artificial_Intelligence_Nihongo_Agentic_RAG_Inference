import sqlite3
from pathlib import Path


def init_database(db_dir: str = "database", db_name: str = "ai_naragi.db") -> None:
    db_path = Path(db_dir)
    db_path.mkdir(exist_ok=True)

    db_file = db_path / db_name
    schema_file = db_path / "schema.sql"

    if not schema_file.exists():
        raise FileNotFoundError(f"Schema file not found: {schema_file}")

    with open(schema_file, "r", encoding="utf-8") as f:
        schema = f.read()

    with sqlite3.connect(db_file) as conn:
        conn.executescript(schema)
        conn.commit()

    print(f"Database initialized successfully: {db_file}")


if __name__ == "__main__":
    init_database()