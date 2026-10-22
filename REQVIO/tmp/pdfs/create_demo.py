from pathlib import Path
from xml.sax.saxutils import escape

import pymupdf
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'output' / 'pdf'
OUTPUT.mkdir(parents=True, exist_ok=True)
styles = getSampleStyleSheet()
styles.add(ParagraphStyle('Brand', fontName='Helvetica-Bold', fontSize=10, textColor=colors.HexColor('#388087'), spaceAfter=12))
styles.add(ParagraphStyle('DemoTitle', fontName='Helvetica-Bold', fontSize=23, leading=27, spaceAfter=15, textColor=colors.HexColor('#12373B')))
styles.add(ParagraphStyle('Section', fontName='Helvetica-Bold', fontSize=12, leading=16, spaceBefore=13, spaceAfter=6, textColor=colors.HexColor('#2D6A71'), keepWithNext=True))
styles.add(ParagraphStyle('Copy', fontName='Helvetica', fontSize=10.5, leading=15.3, spaceAfter=8, textColor=colors.HexColor('#253F43')))
styles.add(ParagraphStyle('Notice', parent=styles['Copy'], fontSize=9, leading=13, backColor=colors.HexColor('#EDF2EF'), borderPadding=9, spaceAfter=16))


def p(text, style='Copy'):
    return Paragraph(escape(text), styles[style])


def section(story, title, text):
    story.extend([p(title, 'Section'), p(text)])


def footer(canvas, doc):
    canvas.setStrokeColor(colors.HexColor('#DCE5E2'))
    canvas.line(48, 40, A4[0] - 48, 40)
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(colors.HexColor('#5A7A7E'))
    canvas.drawString(48, 27, 'REQVIO DEMO | Fictional proposal. No participant data collected.')
    canvas.drawRightString(A4[0] - 48, 27, str(doc.page))


def build(name, story):
    path = OUTPUT / name
    SimpleDocTemplate(str(path), pagesize=A4, topMargin=45, bottomMargin=55, leftMargin=48, rightMargin=48,
                      title=name.replace('-', ' ').replace('.pdf', ''), author='Reqvio Demo').build(
                          story, onFirstPage=footer, onLaterPages=footer)
    return path


rubric = [p('REQVIO / DEMO RUBRIC', 'Brand'), p('Study Habits & Academic Performance', 'DemoTitle'),
          p('Proposal review instructions', 'Section'),
          p('Use this fictional classroom rubric to review the matching research draft. Each criterion is a separate requirement. This is a demonstration rubric, not a validated assessment instrument.', 'Notice')]
criteria = [
    ('R1 / Research problem and rationale / 15 points',
     'State a focused research problem about the relationship between study habits and academic performance among senior high school students. Explain why the proposed study matters.'),
    ('R2 / Objectives and research questions / 15 points',
     'Provide one general objective, at least two specific objectives, and at least two research questions. Define the study-habit measures and the academic-performance measure.'),
    ('R3 / Methodology and sampling / 25 points',
     'Identify the research design, target population, intended sample size, sampling method, inclusion criteria, and recruitment procedure. Explain how participants will be selected.'),
    ('R4 / Instrument and data collection / 15 points',
     'Describe the questionnaire and collection procedure. Include at least three example items and explain how the instrument will be checked for clarity before use.'),
    ('R5 / Ethics and data protection / 20 points',
     'Explain informed consent, any required guardian consent for minors, voluntary participation, withdrawal, confidentiality, access controls, and a defined data retention and deletion period.'),
    ('R6 / Analysis, limitations, and sources / 10 points',
     'Describe how the variables will be analyzed, identify at least two study limitations, and cite at least two real academic sources using a consistent reference style. Do not claim that correlation proves causation.')]
for title, text in criteria:
    section(rubric, title, text)
rubric_path = build('reqvio-demo-rubric.pdf', rubric)

draft = [p('REQVIO / RESEARCH DRAFT V1', 'Brand'),
         p('Study Habits and Self-Reported Academic Performance', 'DemoTitle'),
         p('Among senior high school students | Fictional research proposal', 'Copy'),
         p('DEMO ONLY: This draft is intentionally incomplete so reviewers can practice identifying gaps. It describes a proposed study. No survey has been conducted, no school is identified, and no findings or academic sources are fabricated.', 'Notice')]
section(draft, '1. Background and research problem',
        'Students organize their study time in different ways. Some review lessons every day, while others concentrate their preparation close to an examination. This proposed study asks whether reported study habits are associated with self-reported academic performance among senior high school students. The project aims to help a student research team describe patterns that could inform study-planning discussions. The proposal does not assume that one habit causes higher grades.')
section(draft, '2. General and specific objectives',
        'The general objective is to examine the relationship between selected study habits and self-reported academic performance. The specific objectives are: (1) describe the frequency and duration of students\' study sessions; (2) describe how often students use planned study schedules; and (3) examine whether these measures are associated with self-reported average grades from the most recent completed grading period.')
section(draft, '3. Research questions and measures',
        'Question 1: How many days per week do participating students study outside scheduled classes? Question 2: How often do they follow a study schedule? Question 3: What association exists between reported study time, schedule use, and self-reported average grade? Study time will be recorded as days per week and approximate minutes per study day. Schedule use will be recorded on a five-point frequency scale. Academic performance will be measured using the student\'s self-reported average grade for the most recent completed grading period.')
section(draft, '4. Significance and scope',
        'The intended population is senior high school students. The proposal focuses on study routines and reported grades rather than intelligence, teaching quality, or access to learning resources. The research team intends to produce a descriptive classroom report. Any association would support further investigation rather than justify an official judgment about a student.')
draft.append(PageBreak())
draft.extend([p('REQVIO / RESEARCH DRAFT V1', 'Brand'), p('Proposed methods', 'DemoTitle')])
section(draft, '5. Research design and participants',
        'The study will use a quantitative, cross-sectional correlational design. The team intends to collect approximately 60 questionnaire responses from senior high school students through a shared survey link. Students will answer once during a single collection period. The team has not yet specified a sampling method, eligibility rules, or recruitment process. These decisions will be completed before any data collection begins.')
section(draft, '6. Questionnaire and collection procedure',
        'A short questionnaire will record study frequency, approximate study duration, schedule use, and the self-reported average grade. The survey will be distributed through a link and remain open for one week. Example item 1: During a typical week, on how many days do you study outside scheduled classes? Example item 2: About how many minutes do you study on those days? The team will export responses to a spreadsheet and check for duplicate or incomplete entries. The questionnaire has not yet undergone a clarity check.')
section(draft, '7. Proposed analysis',
        'The team will summarize study frequency and duration with descriptive statistics. Schedule-use responses will be reported as category counts. After checking the data and the assumptions of the selected method, the team will examine associations between study measures and reported average grades. The specific correlation procedure and treatment of missing responses have not yet been selected. The report will state that a correlation does not establish causation.')
section(draft, '8. Data handling note',
        'The exported spreadsheet will be stored on the team\'s shared drive while the report is prepared. A complete ethics and data protection procedure has not yet been written. No collection should begin until appropriate consent and safeguards are established.')
section(draft, '9. Limitations and references',
        'Self-reported grades may contain recall errors. Students who choose to complete the questionnaire may differ from students who do not respond. A one-time survey cannot establish which factor occurred first. The literature review and reference list are not yet included; the team must locate, read, and cite real academic sources before submission.')
draft_path = build('reqvio-demo-research-draft.pdf', draft)

for path in (rubric_path, draft_path):
    with pymupdf.open(path) as doc:
        assert all(page.get_text().strip() for page in doc)
        print(f'{path.name}: {len(doc)} pages, selectable text verified')
        for i, page in enumerate(doc):
            page.get_pixmap(matrix=pymupdf.Matrix(1, 1)).save(str(ROOT / 'tmp' / 'pdfs' / f'{path.stem}-{i+1}.png'))
