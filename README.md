# Reqvio

Reqvio checks a research draft against its rubric and shows exactly where each requirement is met, including the supporting passage and page number.

---

## Team

### Front-End Developers
- Johana Antonette P. Cordova
- Mharie Franz F. Canton

### Back-End Developers
- Kirsten Van B. Ecarma
- Khatara Carie T. Sanchez

---

## What It Does

Reqvio provides research teams with a workspace for managing drafts, rubrics, reviews, and collaboration.

Upload a rubric and a draft, and the AI review identifies which requirements are:

- ✅ Met
- 🟡 Partially Met
- ❌ Missing
- 🔍 Needs Review

Each result includes the supporting passage and page number so students can verify the findings themselves.

### Additional Features

#### 📋 Tasks & Progress Tracking
- Assign tasks to members
- Monitor assigned, completed, and overdue tasks

#### 👥 Contribution Tracking
- Measure team participation and individual contributions
- Available in the Research Team plan

#### 🔄 Revision Comparison
- Compare earlier and newer reviews
- Track improvements between revisions

#### 📚 Research History & PDF Reports
- Store review history
- Generate teacher-ready PDF reports with evidence

#### 🔗 Join Codes
- Invite members to a workspace using a join code

---

## Demo

🎥 **Video Demo**

https://drive.google.com/file/d/1OOgeupaxpMKtNAX4wwcYh-3VGhrSEX9a/view?fbclid=IwY2xjawVGrYpleHRuA2FlbQIxMQBwZG9mA3NydGMGYXBwX2lkATAAAR7vPxMd11p0XsRf6GioIdSMIIZNFJekDdlBCG9FUyaKfrD9yQcT1jVNe3F02w_aem_qk-NPcIz5Tk9alFmeZbslQ


📑 **Presentation Slides**

https://www.canva.com/design/DAHYtUyY9vc/9_yavBWj8AYa1usjRT57Qg/edit

---

## How It Works

### Tech Stack

#### Front-End
- HTML
- CSS
- JavaScript
- No build step

**Fonts**
- Bricolage Grotesque
- Instrument Sans
- IBM Plex Mono

#### Back-End
- Python

#### AI & Retrieval
- Claude Haiku (via FUTURE FORGE Open WebUI API)
- Qwen3 Embedding

---

## How AI Is Used

1. The rubric is analyzed to identify all requirements.
2. The draft is split into passages and indexed with page references.
3. For each requirement, the most relevant passages are retrieved.
4. The AI evaluates whether the requirement is:
   - Met
   - Partial
   - Missing
   - Needs Review
5. Supporting evidence and page references are returned.
6. Before labeling a requirement as "Missing," a wider search of the draft is performed to reduce false negatives.

Every review result links back to the exact text and page where the evidence was found.

---

# Business Plan

## Problem

Students working on group research papers often struggle to determine whether their draft satisfies the grading rubric. Teams also face challenges tracking contributions and workload distribution.

Common issues include:

- Missing rubric requirements that lower grades
- Uneven contribution among group members
- Difficulty monitoring team progress

---

## Target Users

- Senior High School students in the Philippines
- College students working on research projects
- Classes that use rubric-based assessment

---

## Solution

Reqvio helps students identify missing rubric requirements before submission.

The MVP provides:

- AI-assisted rubric checking
- Evidence-based requirement matching
- Task management
- Contribution tracking
- Review history
- PDF report generation

---

## Pricing

| Plan | Price | Features |
|--------|---------|---------|
| Free | $0 | 2 AI checks/month, 1 project |
| Student Pro | $1.49/month or $12.99/year (~₱91/month) | 15 checks/month, 3 projects, comparison tools, PDF reports |
| Research Team | $3.49/month or $31.99/year (~₱213/month) | 40 shared checks, 10 projects, up to 5 members, contribution tracking |
| Research Pass | $2.99 one-time | 20 checks valid for 90 days |

### Payment Methods
- GCash
- Maya
- Debit/Credit Cards

---

## Revenue Model

Revenue is generated through subscription plans and one-time purchases.

Expected costs include:

- Server hosting
- AI API usage
- Payment processing fees
- Taxes

Break-even projections are calculated by comparing monthly expenses against subscription revenue.

---

## Competitive Advantage

### General AI Chatbots
Can analyze drafts, but cannot:
- Check against a specific rubric
- Show requirement-level evidence
- Track team contributions

### Grammar & Plagiarism Tools
Can assess writing quality, but do not:
- Evaluate rubric compliance
- Manage research tasks
- Track team participation

### Project Management Tools
Examples:
- Trello
- Google Docs

They support collaboration, but lack:
- Rubric-based review
- Requirement tracking
- Research-specific AI analysis

### Why Reqvio?

Reqvio combines:

✅ Rubric checking  
✅ Evidence retrieval  
✅ Team task management  
✅ Contribution tracking  

in a single platform designed specifically for student research teams.

---

## Roadmap (1–3 Months)

1. Pilot testing with selected classes
2. Collect feedback on review accuracy
3. Integrate GCash, Maya, and card payments
4. Add teacher accounts
5. Create shared rubric templates
6. Support additional file types
7. Improve Filipino-language support
8. Refine AI accuracy using pilot feedback

---

## Tagline

> **Research your rubric, not your luck.**
>
> Find missing requirements before submission, track team progress, and improve research quality with evidence-backed AI reviews.
