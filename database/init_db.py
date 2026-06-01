import os
import sqlite3


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


if __name__ == "__main__":
    initialize_database()