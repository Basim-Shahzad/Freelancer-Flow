from io import BytesIO
from reportlab.lib.pagesizes import A4, HALF_LETTER, A5
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle, Paragraph, SimpleDocTemplate, Spacer
from reportlab.lib.styles import getSampleStyleSheet

def generate_invoice_pdf(invoice):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A5)
    styles = getSampleStyleSheet()
    elements = []

    # Header
    elements.append(Paragraph(f"<b>Invoice #{invoice.invoice_number}</b>", styles['Title']))
    elements.append(Spacer(1, 12))

    # Freelancer and Client Info
    freelancer_name = invoice.freelancer.get_full_name() or invoice.freelancer.username
    client_name = invoice.client.name
    elements.append(Paragraph(f"<b>Freelancer:</b> {freelancer_name}", styles['Normal']))
    elements.append(Paragraph(f"<b>Client:</b> {client_name}", styles['Normal']))
    elements.append(Paragraph(f"<b>Project:</b> {invoice.project.title if invoice.project else 'N/A'}", styles['Normal']))
    elements.append(Spacer(1, 12))

    # Invoice Details Table
    data = [
        ['Description', 'Payment', 'Status', 'Issue Date', 'Due Date'],
        [invoice.description, f"${invoice.payment}", invoice.status, str(invoice.issue_date), str(invoice.due_date)],
    ]
    table = Table(data, colWidths=[80*mm, 30*mm, 30*mm, 30*mm, 30*mm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.black),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 12))

    # Notes
    if invoice.notes:
        elements.append(Paragraph(f"<b>Notes:</b> {invoice.notes}", styles['Normal']))

    # Build the PDF
    doc.build(elements)
    pdf_value = buffer.getvalue()
    buffer.close()
    return pdf_value
