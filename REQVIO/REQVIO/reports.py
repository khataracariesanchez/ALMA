"""Teacher report renderer; all user and AI text is escaped before markup."""
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer


def render_report(data):
    buffer = BytesIO()
    styles = getSampleStyleSheet()
    styles['BodyText'].spaceAfter = 8
    story = []

    def text(value, style='BodyText'):
        story.append(Paragraph(escape(str(value)).replace('\n', '<br/>'), styles[style]))

    text('Reqvio Research Report', 'Title')
    text(data['title'], 'Heading1')
    text(data['advisory'])
    text('Research team', 'Heading2')
    for member in data['members']:
        text(f"{member['name']} ({member['role']})")
    text('Task progress', 'Heading2')
    for task in data['tasks']:
        text(f"{task['title']} - {task['status']} | Deadline: {task['deadline'] or 'Not set'}")
    if data.get('contributions'):
        text('Recorded contributions', 'Heading2')
        for item in data['contributions']:
            text(f"{item['name']}: {item['action']} ({item['count']})")
    text('Latest requirement review', 'Heading2')
    if not data['findings']:
        text('No AI review has been completed.')
    for finding in data['findings']:
        text(finding['requirement'], 'Heading3')
        text(f"Status: {finding['status']}")
        text(finding['explanation'])
        text(f"Recommended action: {finding.get('recommendation', '')}")
        for citation in finding['citations']:
            text(f"Evidence: {citation['filename']}, page {citation['page']}: {citation['quote']}")
        story.append(Spacer(1, 8))

    def footer(canvas, doc):
        canvas.setFillColor(colors.HexColor('#64748B'))
        canvas.setFont('Helvetica', 9)
        canvas.drawString(0.7 * inch, 0.4 * inch, 'Reqvio | Advisory research review')
        canvas.drawRightString(7.5 * inch, 0.4 * inch, str(doc.page))

    SimpleDocTemplate(buffer, rightMargin=50, leftMargin=50, topMargin=45,
                      bottomMargin=50).build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()
