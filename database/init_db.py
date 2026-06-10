import os
import sqlite3
import pandas as pd

def initialize_database():
    # Lấy đường dẫn của thư mục hiện tại chứa tệp init_db.py
    current_dir = os.path.dirname(os.path.abspath(__file__))

    # Xác định đường dẫn tuyệt đối tới 2 tệp db và sql
    db_path = os.path.join(current_dir, "ai_naragi.db")
    schema_path = os.path.join(current_dir, "schema.sql")

    # Kiểm tra xem tệp schema.sql có tồn tại không
    if not os.path.exists(schema_path):
        print(f"Lỗi: Không tìm thấy tệp {schema_path}")
        return

    print(f"Đang kết nối tới database: {db_path}...")
    conn = None

    try:
        # Kết nối tới SQLite (tự động tạo tệp nếu chưa có)
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Đọc nội dung tệp schema.sql
        print(f"Đang đọc tệp cấu trúc: {schema_path}...")
        with open(schema_path, "r", encoding="utf-8") as f:
            schema_sql = f.read()

        # Thực thi chuỗi lệnh SQL (hỗ trợ nhiều câu lệnh cách nhau bằng dấu mô-đun ;)
        print("Đang khởi tạo các bảng dữ liệu...")
        cursor.executescript(schema_sql)

        # Lưu lại thay đổi
        conn.commit()
        print("Chúc mừng! Khởi tạo cơ sở dữ liệu ai_naragi.db thành công.")

    except sqlite3.Error as e:
        print(f"Lỗi SQLite xảy ra: {e}")
        if conn:
            conn.rollback()  # Hoàn tác nếu có lỗi nửa chừng

    except Exception as e:
        print(f"Đã xảy ra lỗi hệ thống: {e}")

    finally:
        # Đảm bảo đóng kết nối dù có lỗi hay không
        if conn:
            conn.close()
            print("Đã đóng kết nối database an toàn.")


def import_voicevox_csv_with_pandas(
                                    csv_path="voicevox_unique_ids.csv", 
                                    db_path="voicevox_characters.db"):
    """Đọc dữ liệu từ file CSV bằng Pandas và đẩy vào bảng CharacterVoice trong

    SQLite.

    Tham số:
    csv_path (str): Đường dẫn tới file dữ liệu CSV đầu vào.
    db_path (str): Đường dẫn tới file database SQLite đầu ra.
    """
    # 1. Kiểm tra sự tồn tại của file CSV
    if not os.path.exists(csv_path):
        print(f"[-] Lỗi: Không tìm thấy file dữ liệu tại '{csv_path}'.")
        return False

    conn = None
    try:
        df = pd.read_csv(csv_path, encoding="utf-8-sig")
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        insert_query = """
        INSERT OR REPLACE INTO character_voice (voice_id, character_ja, character_en, style, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP);
        """

        for row in df.itertuples(index=False):
            cursor.execute(insert_query, (row.voice_id, row.character_ja, row.character_en, row.style))
        conn.commit()

        print(
            f"[+] Thành công! Pandas đã nạp {len(df)} dòng dữ liệu vào bảng 'character_voice'."
        )
        print(f"[+] Cơ sở dữ liệu được lưu tại: '{os.path.abspath(db_path)}'")
        return True

    except sqlite3.Error as sqlite_error:
        print(f"[-] Lỗi Cơ sở dữ liệu (SQLite): {sqlite_error}")
        if conn:
            conn.rollback()
        return False

    except Exception as e:
        print(f"[-] Đã xảy ra lỗi hệ thống: {e}")
        if conn:
            conn.rollback()
        return False

    finally:
        # Đảm bảo đóng kết nối an toàn
        if conn:
            conn.close()

if __name__ == "__main__":
    initialize_database()
    import_voicevox_csv_with_pandas(db_path="ai_naragi.db", 
                                    csv_path="voicevox_unique_ids.csv")
    