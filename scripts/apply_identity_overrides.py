"""
ESPN's API exposes real display names only for managers who've set one;
everyone else shows up as an opaque `espn########` placeholder. This maps
those placeholders to real names (confirmed by the league commissioner)
and merges any duplicate member records (e.g. someone who made a second
ESPN account partway through the league's history).

Run after fetch_espn_data.py — safe to re-run any time (idempotent).
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "fantasyfootball.db"

# member_id -> real display name
RENAMES = {
    "{3E552F36-0195-4D33-B065-0C9523FB37FC}": "Ben",
    "{58321686-54E6-4AB6-B7A6-20DE8902E44B}": "Drew Sheehan",
    "{7305A686-7857-4C45-8B06-E5A22837D385}": "Max",
    "{888F9250-2AD4-4E73-8FED-E4DD4589212B}": "Will",
    "{C86E7708-25E8-4526-8A11-FA97559206ED}": "Eddie Iuteri",
    "{8FD21DCD-D534-415A-921D-CDD534215A17}": "Michael Grabel",
    "{1B936DF8-B911-4B8A-9D86-828AA4A13B5D}": "Jeronimo Camou",
}

# duplicate_member_id -> canonical_member_id (stats/picks get reassigned, duplicate row removed)
MERGES = {
    "{DA600377-8198-49CF-8E14-8BE8A2ED2D4B}": "{C86E7708-25E8-4526-8A11-FA97559206ED}",
}


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    for dup_id, canonical_id in MERGES.items():
        cur.execute("SELECT 1 FROM members WHERE member_id = ?", (dup_id,))
        if not cur.fetchone():
            continue
        cur.execute("UPDATE teams SET primary_owner = ? WHERE primary_owner = ?", (canonical_id, dup_id))
        cur.execute("UPDATE draft_picks SET member_id = ? WHERE member_id = ?", (canonical_id, dup_id))
        cur.execute("DELETE FROM members WHERE member_id = ?", (dup_id,))
        print(f"merged {dup_id} -> {canonical_id}")

    for member_id, name in RENAMES.items():
        cur.execute(
            "UPDATE members SET display_name = ? WHERE member_id = ?",
            (name, member_id),
        )
        print(f"renamed {member_id} -> {name}")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()
