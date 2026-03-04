"""PDF report generation using ReportLab."""

import logging
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    PageBreak,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

from app.config import BASE_DIR
from app.services.analyzer import Analyzer, TestResult

logger = logging.getLogger(__name__)

REPORT_DIR = BASE_DIR / "data" / "reports"

# Register Japanese CID font
try:
    pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
    JA_FONT = "HeiseiKakuGo-W5"
except Exception:
    JA_FONT = "Helvetica"


def _get_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        "TitleJA",
        parent=styles["Title"],
        fontName=JA_FONT,
        fontSize=18,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "HeadingJA",
        parent=styles["Heading2"],
        fontName=JA_FONT,
        fontSize=13,
        spaceBefore=12,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "BodyJA",
        parent=styles["Normal"],
        fontName=JA_FONT,
        fontSize=9,
        leading=13,
    ))
    return styles


def generate_report(test_id: int, logo_path: Path | None = None) -> Path:
    """Generate a PDF report for a completed test and return the file path."""
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    analyzer = Analyzer()
    result: TestResult = analyzer.determine_winner(test_id)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"report_{test_id}_{timestamp}.pdf"
    pdf_path = REPORT_DIR / filename

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
    )

    styles = _get_styles()
    story = []

    # --- Header: Logo + Title ---
    header_parts = []
    if logo_path and logo_path.is_file():
        try:
            img = Image(str(logo_path), width=120, height=40)
            img.hAlign = "LEFT"
            header_parts.append(img)
            header_parts.append(Spacer(1, 6))
        except Exception:
            pass

    header_parts.append(Paragraph("A/B Test Report", styles["TitleJA"]))
    header_parts.append(Paragraph(
        f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        styles["BodyJA"],
    ))
    story.extend(header_parts)
    story.append(Spacer(1, 10))

    # --- Test Overview ---
    story.append(Paragraph("Test Overview", styles["HeadingJA"]))
    overview_data = [
        ["Video Title", result.video_title],
        ["Test ID", str(result.test_id)],
        ["Video ID", result.video_id],
        ["Patterns", str(len(result.variants))],
    ]
    overview_table = Table(overview_data, colWidths=[100, 380])
    overview_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), JA_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.grey),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(overview_table)
    story.append(Spacer(1, 10))

    # --- Winner Summary ---
    story.append(Paragraph("Winner", styles["HeadingJA"]))
    winner = result.winner
    winner_text = (
        f"Pattern {winner.label} — "
        f"Score: {winner.composite_score:.1f} pts"
    )
    if winner.improvement_pct > 0:
        winner_text += f" (+{winner.improvement_pct:.1f}% vs worst)"

    winner_data = [[winner_text]]
    winner_table = Table(winner_data, colWidths=[480])
    winner_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), JA_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("BACKGROUND", (0, 0), (-1, -1), colors.Color(0.9, 1, 0.9)),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.Color(0.1, 0.5, 0.1)),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.Color(0.7, 0.9, 0.7)),
    ]))
    story.append(winner_table)
    story.append(Spacer(1, 10))

    # --- Score Comparison Table ---
    story.append(Paragraph("Score Comparison", styles["HeadingJA"]))
    score_header = ["Pattern", "Score", "Velocity", "Measurements", "Views Gained", "Improvement"]
    score_rows = [score_header]
    for v in result.variants:
        score_rows.append([
            f"Pattern {v.label}",
            f"{v.composite_score:.1f}",
            f"{v.avg_velocity:.1f} v/h",
            str(v.measurement_count),
            f"+{v.total_views_gained:,}",
            f"+{v.improvement_pct:.1f}%" if v.improvement_pct > 0 else "-",
        ])

    score_table = Table(score_rows, colWidths=[80, 60, 80, 80, 90, 90])
    score_style = [
        ("FONTNAME", (0, 0), (-1, -1), JA_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.93, 0.93, 0.93)),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.Color(0.85, 0.85, 0.85)),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    # Highlight winner row
    for i, v in enumerate(result.variants):
        if v.is_winner:
            score_style.append(
                ("BACKGROUND", (0, i + 1), (-1, i + 1), colors.Color(0.93, 1, 0.93))
            )
    score_table.setStyle(TableStyle(score_style))
    story.append(score_table)
    story.append(Spacer(1, 10))

    # --- Metric Detail Table ---
    story.append(Paragraph("Metric Detail", styles["HeadingJA"]))
    metric_header = ["Metric", "Weight"]
    for v in result.variants:
        metric_header.append(f"{v.label} (Raw)")
    for v in result.variants:
        metric_header.append(f"{v.label} (Score)")

    metric_rows = [metric_header]
    for key, weight in result.weights.items():
        row = [key, str(weight)]
        for v in result.variants:
            ms = v.metrics.get(key)
            row.append(f"{ms.raw_value:.2f}" if ms else "-")
        for v in result.variants:
            ms = v.metrics.get(key)
            row.append(f"{ms.weighted:.1f}" if ms else "-")
        metric_rows.append(row)

    num_variants = len(result.variants)
    col_w = max(40, (480 - 100 - 40) // (num_variants * 2))
    metric_cols = [100, 40] + [col_w] * (num_variants * 2)
    metric_table = Table(metric_rows, colWidths=metric_cols)
    metric_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), JA_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.93, 0.93, 0.93)),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.Color(0.85, 0.85, 0.85)),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(metric_table)

    # --- Footer ---
    story.append(Spacer(1, 20))
    story.append(Paragraph(
        "Generated by YT A/B Test",
        ParagraphStyle("Footer", fontName=JA_FONT, fontSize=7, textColor=colors.grey),
    ))

    doc.build(story)
    logger.info("PDF report generated: %s", filename)
    return pdf_path
