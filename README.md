<img width="337" height="2268" alt="image" src="https://github.com/user-attachments/assets/65be25f9-f8da-416e-9d1f-84801dd54bdc" /># Reqvio
Research your rubric, not your luck: Reqvio checks a draft against its rubric and shows exactly where each requirement is met.

## Team
- Johana Antonette P. Cordova & Mharie Franz F. Canton: Front-End Developers
- Kirsten Van B. Ecarma & Khatara Carie T. Sanchez: Back-End Developers

## What it does
Reqvio gives each research team a workspace for drafts, rubrics, and tasks. Upload your rubric and your draft, and the AI review shows which requirements are met, with the passage and page it found them on.

Beyond the review, teams get:
- **Tasks and progress:** assign work to members and track assigned, completed, and overdue tasks.
- **Contribution tracking:** see who has done their fair share (Research Team plan).
- **Revision comparison:** compare an earlier review with a newer one to see which requirements improved.
- **Research history and PDF reports:** keep every review and export a teacher-ready report with evidence.
- **Join codes:** invite members to a workspace with a code.

## Demo video
[Watch Here](https://drive.google.com/file/d/1xlY5EYO-5vaFh8whwRvvihaS0mbyLI9A/view?fbclid=IwY2xjawVGqV9leHRuA2FlbQIxMQBwZG9mA3NydGMGYXBwX2lkATAAAR4vFDDoY74YuYAT5NkU86hivEcfLiTQxQ_dhTbU8YRGfw1syGO1CJSMVIIwNA_aem_RH8ZiMx_tbyapwRLik5ctw)
## Slides
[View the slides on Canva](https://www.canva.com/design/DAHYtUyY9vc/9_yavBWj8AYa1usjRT57Qg/edit?fbclid=IwY2xjawVGkYJleHRuA2FlbQIxMQBwZG9mA3NydGMGYXBwX2lkATAAAR6StpuBSx_BgTBlLxnI8F1niHN4TccyB6lfntHUEQzNtNnXs0b9jRgI5e3p5w_aem_ulMjh4m2PgLlIeoVzw_ssg)

## How it works

### Tech stack
- **Front end:** plain HTML, CSS, and JavaScript with no build step. Fonts are Bricolage Grotesque, Instrument Sans, and IBM Plex Mono.
- **Back end:** `Python`
- **AI:** Uses Claude Haiku (via the FUTURE FORGE Open WebUI API) to generate answers, and Qwen3-Embedding.

### How AI is used
1. The rubric is read once to list its requirements.
2. The draft is split into passages, with their page numbers, and indexed for retrieval.
3. For each requirement, the most relevant passages are retrieved and sent to the model, which marks the requirement Met, Partial, Missing, or Needs review and quotes the evidence.
4. Before a requirement is called Missing, a wider check runs over more of the draft to avoid false negatives.

Every result points back to the passage and page it came from, so a student can verify it instead of trusting the AI.


## Business plan

### Problem
Students working on group research papers can't easily tell whether a draft meets the rubric, and teams can't see who contributed what. Rubric misses cost grades, and uneven contribution causes conflict.

### Target users
Senior high school and college students in the Philippines doing group research, starting with classes where a single rubric grades the whole paper.

### Solution and value
The MVP checks a draft against its rubric with evidence from the text, tracks tasks, and shows each member's contribution. Students fix gaps before submission and teachers get a clear report.

### Revenue or sustainability
Freemium, priced for students in USD and shown in pesos:

| Plan | Price | What you get |
|---|---|---|
| Free | $0 | 2 AI checks a month, 1 project |
| Student Pro | $1.49/month or $12.99/year (about ₱91/month) | 15 checks a month, 3 projects, comparison, PDF reports |
| Research Team | $3.49/month or $31.99/year (about ₱213/month) | 40 shared checks, 10 projects, up to 5 members (4 minimum to subscribe), contribution tracking |
| Research Pass | $2.99 one-time | 20 checks over 90 days |

Payments would go through GCash, Maya, and cards. Our profit model shows monthly costs against revenue and where break-even falls. Costs are servers, AI, payment fees, and tax.

### Competition
General AI chat tools can comment on a draft but don't check it against your rubric, point to the page, or track a team. Plagiarism and grammar checkers look at writing quality, not requirements. Project tools like Trello or Google Docs handle tasks and writing but have no rubric review. Reqvio combines the three for student research teams.

### Next steps (1-3 months)
1. Pilot with a few classes and collect feedback on review accuracy.
2. Connect real payments (GCash, Maya, cards).
3. Add teacher accounts and shared rubric templates.
4. Support more file types and Filipino-language drafts.
5. Improve accuracy with feedback from the pilot.
