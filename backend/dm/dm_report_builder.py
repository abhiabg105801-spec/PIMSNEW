# backend/dm/dm_report_builder.py
import io
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

def build_dm_pdf(date_str: str, entries):
    """
    entries: list of ORM objects (DMEntryDB)
    Returns: bytes of PDF
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=20, leftMargin=20, topMargin=30, bottomMargin=30)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("<b>DM Unified Daily Report</b>", styles["Title"]))
    story.append(Paragraph(f"Date: {date_str}", styles["Normal"]))
    story.append(Spacer(1, 12))

    # Build stats by (module, category, parameter)
    stats_map = {}
    for e in entries:
        key = (e.module or "-", e.category or "-", e.parameter or "-")
        lst = stats_map.setdefault(key, [])
        if e.value is not None:
            try:
                lst.append(float(e.value))
            except:
                pass

    # Summaries table
    table_data = [["Module", "Category", "Parameter", "Avg", "Min", "Max", "Count"]]
    for (module, cat, param), vals in sorted(stats_map.items()):
        if vals:
            avg = round(sum(vals) / len(vals), 4)
            mn = round(min(vals), 4)
            mx = round(max(vals), 4)
            cnt = len(vals)
        else:
            avg = mn = mx = "-"
            cnt = 0
        table_data.append([module, cat, param, avg, mn, mx, cnt])

    summary_table = Table(table_data, repeatRows=1, colWidths=[80, 80, 120, 60, 60, 60, 40])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("ALIGN", (3, 1), (-1, -1), "RIGHT"),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 18))

    # Raw grouped section: group by (module, category, location, parameter)
    raw_map = {}
    for e in entries:
        key = (e.module or "-", e.category or "-", e.location or e.exact_collection_area or "-", e.parameter or "-")
        raw_map.setdefault(key, []).append((e.time, e.value, e.remarks))

    for (module, cat, loc, param), rows in sorted(raw_map.items()):
        story.append(Paragraph(f"<b>{module} — {cat} — {loc} — {param}</b>", styles["Heading3"]))
        raw_data = [["Time", "Value", "Remarks"]]
        for (t, v, r) in sorted(rows, key=lambda x: str(x[0])):
            raw_data.append([str(t), str(v) if v is not None else "-", r or "-"])

        ttable = Table(raw_data, repeatRows=1, colWidths=[60, 80, 350])
        ttable.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (1, 1), (1, -1), "RIGHT")
        ]))
        story.append(ttable)
        story.append(Spacer(1, 12))

    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
