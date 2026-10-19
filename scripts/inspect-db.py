"""只读检查 PinPlan 的本地数据库（开发自检用）。"""

import os
import sqlite3

path = os.path.join(os.environ["APPDATA"], "com.pinplan.desktop", "pinplan.db")
con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)

tables = [r[0] for r in con.execute("select name from sqlite_master where type='table' order by name")]
print("tables:", tables)

for t in ("project", "plan", "bug", "event", "checkin", "setting"):
    try:
        n = con.execute(f"select count(*) from {t}").fetchone()[0]
        print(f"  {t}: {n} rows")
    except Exception as exc:  # noqa: BLE001
        print(f"  {t}: ERR {exc}")

print("\n--- plan ---")
for r in con.execute("select id,title,status,priority,created_at from plan order by id"):
    print(" ", r)

print("\n--- bug ---")
for r in con.execute("select id,title,status,severity from bug order by id"):
    print(" ", r)

print("\n--- event ---")
for r in con.execute("select id,entity,entity_id,kind,from_value,to_value from event order by id"):
    print(" ", r)

print("\n--- setting ---")
for r in con.execute("select key,value from setting order by key"):
    print(" ", r)

con.close()
