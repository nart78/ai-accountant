"""PDF invoice generator using ReportLab."""
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable,
)
from reportlab.lib import colors


COMPANY_NAME = "2191584 Alberta Inc."
GST_NUMBER = "794689075 RT0001"

INDIGO = HexColor("#4F46E5")
INDIGO_LIGHT = HexColor("#EEF2FF")
SLATE_800 = HexColor("#1E293B")
SLATE_600 = HexColor("#475569")
SLATE_400 = HexColor("#94A3B8")
SLATE_200 = HexColor("#E2E8F0")
WHITE = colors.white


def _currency(amount: float) -> str:
    """Format a number as CAD currency."""
    return f"${amount:,.2f}"


def generate_invoice_pdf(invoice) -> io.BytesIO:
    """
    Generate a professional PDF for the given invoice.

    Args:
        invoice: SQLAlchemy Invoice object with .customer and .items loaded.

    Returns:
        BytesIO buffer containing the PDF.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.8 * inch,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    style_company = ParagraphStyle(
        "Company", parent=styles["Normal"],
        fontSize=18, leading=22, textColor=SLATE_800, fontName="Helvetica-Bold",
    )
    style_invoice_title = ParagraphStyle(
        "InvoiceTitle", parent=styles["Normal"],
        fontSize=28, leading=32, textColor=INDIGO, fontName="Helvetica-Bold",
        alignment=TA_RIGHT,
    )
    style_label = ParagraphStyle(
        "Label", parent=styles["Normal"],
        fontSize=8, leading=10, textColor=SLATE_400, fontName="Helvetica-Bold",
        spaceAfter=2,
    )
    style_value = ParagraphStyle(
        "Value", parent=styles["Normal"],
        fontSize=10, leading=14, textColor=SLATE_800, fontName="Helvetica",
    )
    style_value_bold = ParagraphStyle(
        "ValueBold", parent=styles["Normal"],
        fontSize=10, leading=14, textColor=SLATE_800, fontName="Helvetica-Bold",
    )
    style_notes = ParagraphStyle(
        "Notes", parent=styles["Normal"],
        fontSize=9, leading=13, textColor=SLATE_600, fontName="Helvetica",
    )
    style_footer = ParagraphStyle(
        "Footer", parent=styles["Normal"],
        fontSize=8, leading=10, textColor=SLATE_400, fontName="Helvetica",
        alignment=TA_CENTER,
    )

    elements = []
    customer = invoice.customer

    # ── Header: Company name + INVOICE title ──
    header_data = [
        [
            Paragraph(COMPANY_NAME, style_company),
            Paragraph("INVOICE", style_invoice_title),
        ]
    ]
    header_table = Table(header_data, colWidths=[3.5 * inch, 3.5 * inch])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.3 * inch))

    # ── Invoice details + Bill To ──
    # Left side: Bill To
    bill_to_parts = [
        Paragraph("BILL TO", style_label),
        Paragraph(customer.name, style_value_bold),
    ]
    if customer.address_line1:
        bill_to_parts.append(Paragraph(customer.address_line1, style_value))
    if customer.address_line2:
        bill_to_parts.append(Paragraph(customer.address_line2, style_value))

    city_parts = []
    if customer.city:
        city_parts.append(customer.city)
    if customer.province:
        city_parts.append(customer.province)
    if city_parts:
        line = ", ".join(city_parts)
        if customer.postal_code:
            line += f"  {customer.postal_code}"
        bill_to_parts.append(Paragraph(line, style_value))
    elif customer.postal_code:
        bill_to_parts.append(Paragraph(customer.postal_code, style_value))

    if customer.email:
        bill_to_parts.append(Paragraph(customer.email, style_value))
    if customer.phone:
        bill_to_parts.append(Paragraph(customer.phone, style_value))

    # Right side: Invoice details
    status_display = invoice.status.upper()
    detail_rows = [
        [Paragraph("INVOICE #", style_label), Paragraph(invoice.invoice_number, style_value_bold)],
        [Paragraph("DATE", style_label), Paragraph(str(invoice.invoice_date), style_value)],
        [Paragraph("DUE DATE", style_label), Paragraph(str(invoice.due_date), style_value)],
        [Paragraph("STATUS", style_label), Paragraph(status_display, style_value_bold)],
    ]
    if invoice.paid_date:
        detail_rows.append(
            [Paragraph("PAID DATE", style_label), Paragraph(str(invoice.paid_date), style_value)]
        )

    detail_table = Table(detail_rows, colWidths=[0.9 * inch, 1.8 * inch])
    detail_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))

    # Combine left (bill to) and right (details) in a 2-column layout
    # Stack bill_to_parts into a single cell
    bill_to_cell = []
    for p in bill_to_parts:
        bill_to_cell.append(p)

    info_data = [[bill_to_cell, detail_table]]
    info_table = Table(info_data, colWidths=[3.5 * inch, 3.5 * inch])
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.4 * inch))

    # ── Line Items Table ──
    items_header = [
        Paragraph("<b>Description</b>", ParagraphStyle("th", fontSize=9, textColor=WHITE, fontName="Helvetica-Bold")),
        Paragraph("<b>Qty</b>", ParagraphStyle("th", fontSize=9, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_RIGHT)),
        Paragraph("<b>Unit Price</b>", ParagraphStyle("th", fontSize=9, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_RIGHT)),
        Paragraph("<b>Amount</b>", ParagraphStyle("th", fontSize=9, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_RIGHT)),
    ]

    items_data = [items_header]
    for item in invoice.items:
        qty_str = f"{item.quantity:g}"  # remove trailing .0
        items_data.append([
            Paragraph(item.description, style_value),
            Paragraph(qty_str, ParagraphStyle("r", fontSize=10, alignment=TA_RIGHT, textColor=SLATE_800)),
            Paragraph(_currency(item.unit_price), ParagraphStyle("r", fontSize=10, alignment=TA_RIGHT, textColor=SLATE_800)),
            Paragraph(_currency(item.amount), ParagraphStyle("r", fontSize=10, alignment=TA_RIGHT, textColor=SLATE_800, fontName="Helvetica-Bold")),
        ])

    items_table = Table(
        items_data,
        colWidths=[3.5 * inch, 0.8 * inch, 1.35 * inch, 1.35 * inch],
        repeatRows=1,
    )

    # Table styling
    table_style = [
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        # Data rows
        ("TOPPADDING", (0, 1), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, SLATE_200),
        # Alignment
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    # Alternating row colors
    for i in range(1, len(items_data)):
        if i % 2 == 0:
            table_style.append(("BACKGROUND", (0, i), (-1, i), INDIGO_LIGHT))

    items_table.setStyle(TableStyle(table_style))
    elements.append(items_table)
    elements.append(Spacer(1, 0.25 * inch))

    # ── Totals ──
    totals_data = [
        ["Subtotal", _currency(invoice.subtotal)],
    ]
    if invoice.gst_rate and invoice.gst_rate > 0:
        totals_data.append([f"GST ({invoice.gst_rate * 100:.0f}%)", _currency(invoice.gst_amount)])

    totals_data.append(["TOTAL", _currency(invoice.total)])

    totals_style_label = ParagraphStyle("tl", fontSize=10, textColor=SLATE_600, alignment=TA_RIGHT)
    totals_style_value = ParagraphStyle("tv", fontSize=10, textColor=SLATE_800, alignment=TA_RIGHT, fontName="Helvetica-Bold")
    totals_style_total_label = ParagraphStyle("ttl", fontSize=12, textColor=SLATE_800, alignment=TA_RIGHT, fontName="Helvetica-Bold")
    totals_style_total_value = ParagraphStyle("ttv", fontSize=12, textColor=INDIGO, alignment=TA_RIGHT, fontName="Helvetica-Bold")

    formatted_totals = []
    for i, (label, value) in enumerate(totals_data):
        if i == len(totals_data) - 1:  # TOTAL row
            formatted_totals.append([
                Paragraph(label, totals_style_total_label),
                Paragraph(value, totals_style_total_value),
            ])
        else:
            formatted_totals.append([
                Paragraph(label, totals_style_label),
                Paragraph(value, totals_style_value),
            ])

    totals_table = Table(
        [["", "", lbl, val] for lbl, val in formatted_totals],
        colWidths=[3.5 * inch, 0.8 * inch, 1.35 * inch, 1.35 * inch],
    )
    totals_table.setStyle(TableStyle([
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("LINEABOVE", (2, len(formatted_totals) - 1), (-1, len(formatted_totals) - 1), 1, SLATE_400),
    ]))
    elements.append(totals_table)

    # ── Notes ──
    if invoice.notes:
        elements.append(Spacer(1, 0.4 * inch))
        elements.append(Paragraph("NOTES", style_label))
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(invoice.notes, style_notes))

    # ── Footer ──
    elements.append(Spacer(1, 0.6 * inch))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=SLATE_200))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(f"GST# {GST_NUMBER}", style_footer))

    doc.build(elements)
    buf.seek(0)
    return buf
