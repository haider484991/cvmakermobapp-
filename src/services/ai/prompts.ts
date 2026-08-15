import type { AIContext, Resume } from '@/types';

/**
 * System prompt establishing the AI's role and the writing contract every
 * feature inherits. This is where output quality is won or lost: the craft
 * rules here apply to summaries, bullets, tailoring and cover letters alike.
 */
export const SYSTEM_PROMPT = `You are an elite resume writer and career coach. Recruiters spend ~7 seconds on a first pass; everything you write must survive that pass and an ATS keyword scan.

WRITING RULES — apply to every resume line you produce:
- Language: write in the same language as the user's own content. Spanish resume in → Spanish out. Default to English only when the input is English or ambiguous.
- No personal pronouns in summaries or bullets (no "I", "my", "we").
- Tense: present tense for current roles, past tense for previous roles.
- Every bullet starts with a strong, specific action verb. Vary the verbs — never start two consecutive bullets with the same one. Never open with "Responsible for", "Helped", "Worked on", "Assisted with", "Tasked with", or "Duties included".
- Quantify with numbers the user stated or clearly implied (%, $, time, team size, users, volume). NEVER invent a number. When no metric exists, anchor the line with concrete scope instead: tools used, stakeholders served, cadence, scale words the user gave.
- Banned phrases — never output any of these: "results-driven", "detail-oriented", "team player", "proven track record", "go-getter", "think outside the box", "hard-working", "passionate", "dynamic", "synergy", "self-starter", "seasoned professional", "fast-paced environment", "excellent communication skills".
- Prefer concrete nouns and verifiable claims over adjectives. Show, don't claim.
- Cut filler: "successfully", "effectively", "various", "numerous", "etc." add nothing.
- ATS-safe output: plain text, standard terminology, no emoji or decorative symbols.
- Authenticity: sharpen what the user actually did. Never fabricate employers, titles, dates, credentials, or metrics.`;

/**
 * Generate context description from AIContext object
 */
function buildContextString(context: AIContext): string {
  const parts: string[] = [];

  if (context.jobTitle) {
    parts.push(`Current/Target Position: ${context.jobTitle}`);
  }

  if (context.industry) {
    parts.push(`Industry: ${context.industry}`);
  }

  if (context.yearsOfExperience) {
    parts.push(`Years of Experience: ${context.yearsOfExperience}`);
  }

  if (context.targetRole) {
    parts.push(`Target Role: ${context.targetRole}`);
  }

  if (context.skills && context.skills.length > 0) {
    parts.push(`Current Skills: ${context.skills.join(', ')}`);
  }

  if (context.experience && context.experience.length > 0) {
    const expSummary = context.experience
      .slice(0, 3)
      .map((exp) => `${exp.title} at ${exp.company}`)
      .join('; ');
    parts.push(`Recent Experience: ${expSummary}`);
  }

  if (context.education && context.education.length > 0) {
    const eduSummary = context.education
      .map((edu) => `${edu.degree} in ${edu.field} from ${edu.institution}`)
      .join('; ');
    parts.push(`Education: ${eduSummary}`);
  }

  return parts.join('\n');
}

/**
 * Prompt for generating professional summaries
 */
export const SUMMARY_PROMPT = (context: AIContext): string => `
Generate 3 distinct professional summary options for a resume. Each summary must be:
- 3-4 sentences, 50-80 words
- No personal pronouns; open with the professional identity, not a filler phrase
  (pattern: "[Title] with [N] years [specialization]…" — vary the construction across the 3 options)
- Built from the candidate's actual background below — reuse their strongest concrete facts and any numbers they provided; never invent numbers
- Loaded with the natural keywords a recruiter searching for the target role would use

Calibrate to seniority:
- 0-2 years: lead with skills, education, and trajectory — concrete projects beat empty confidence
- 3-7 years: lead with specialization and 1-2 proof points of delivered impact
- 8+ years: lead with scope (team size, budget, breadth) and business outcomes

Candidate Information:
${buildContextString(context)}

${context.currentSummary ? `Current Summary (for reference/improvement):\n${context.currentSummary}` : ''}

Return your response as a JSON object with this exact structure:
{
  "summaries": [
    "First professional summary option...",
    "Second professional summary option...",
    "Third professional summary option..."
  ]
}

Each summary takes a different angle (these labels are internal guidance — never echo them or their variations like "results-driven" in the summary text):
1. Ownership: emphasize what they led, owned, or ran
2. Craft: emphasize their strongest technical/domain skills in action
3. Impact: emphasize measurable outcomes and business wins they produced

Every option must be specific enough that it could ONLY describe this candidate — if a line would fit any resume, rewrite it. Final check before answering: none of the banned phrases from your writing rules may appear in any option.
`;

/**
 * Prompt for enhancing experience bullet points
 */
export const BULLET_POINT_PROMPT = (
  bullets: string[],
  context: Partial<AIContext>,
  roleContext?: { isCurrentRole?: boolean }
): string => `
Transform the following bullet points into achievement statements using the XYZ pattern: what was accomplished (X), measured how (Y), by doing what (Z). Where no measurement exists, fall back to action + concrete scope + outcome.

Guidelines:
- ${roleContext?.isCurrentRole ? 'This is a CURRENT role: write every bullet in present tense.' : 'This is a PAST role: write every bullet in past tense.'}
- Start each bullet with a strong, specific action verb; no two bullets in this set may open with the same verb
- Keep the user's real numbers; surface numbers they implied (e.g. "the whole team" → the count if stated elsewhere); NEVER invent a metric
- If a bullet has no possible metric, anchor it with scope: tools, volume words the user gave, stakeholders, cadence
- Impact over duty: say what changed because they did the work, not what they were assigned
- One line each, under 22 words
- Weave in terminology a recruiter for this role would search, where it fits naturally

${context.jobTitle ? `Role Context: ${context.jobTitle}` : ''}
${context.industry ? `Industry: ${context.industry}` : ''}

Original Bullet Points:
${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Return your response as a JSON object with this exact structure:
{
  "bullets": [
    {
      "originalBullet": "The original bullet text",
      "enhancedBullet": "The improved, achievement-focused version",
      "improvements": ["List", "of", "specific", "improvements", "made"]
    }
  ]
}

For each bullet, provide:
- The original text
- An enhanced version that is more impactful
- A list of 2-3 specific improvements made (e.g., "Added quantifiable metric", "Strengthened action verb", "Highlighted business impact")
`;

/**
 * Prompt for suggesting relevant skills
 */
export const SKILL_SUGGESTION_PROMPT = (
  jobTitle: string,
  industry: string,
  existingSkills: string[] = []
): string => `
Suggest relevant skills for a ${jobTitle} position in the ${industry} industry that would strengthen a resume and improve ATS matching.

${existingSkills.length > 0 ? `Current Skills (exclude these from suggestions):\n${existingSkills.join(', ')}` : ''}

Provide a comprehensive list of skills across these categories:
1. Technical Skills - Job-specific tools, technologies, methodologies
2. Soft Skills - Interpersonal and professional competencies
3. Tools & Software - Specific applications and platforms
4. Certifications - Relevant credentials and qualifications
5. Languages - Programming or spoken languages if applicable

Return your response as a JSON object with this exact structure:
{
  "skills": [
    {
      "name": "Skill Name",
      "category": "technical|soft|tools|certifications|languages",
      "relevance": "high|medium|low",
      "reason": "Brief explanation of why this skill is valuable for this role"
    }
  ]
}

Guidelines:
- Suggest 15-20 skills total
- Prioritize skills commonly found in job postings for this role
- Include a mix of categories
- Focus on skills that differentiate candidates
- Consider both current industry standards and emerging trends
- Mark relevance based on how essential each skill is for the role
`;

/**
 * Prompt for scoring and analyzing a resume
 */
export const RESUME_SCORE_PROMPT = (
  resume: Resume,
  jobDescription?: string
): string => `
Analyze this resume and provide a comprehensive score and feedback. Evaluate against professional resume best practices and ${jobDescription ? 'the provided job description' : 'general industry standards'}.

Resume Content:
---
Name: ${resume.header.fullName}
Title: ${resume.header.jobTitle}

Professional Summary:
${resume.summary || '[No summary provided]'}

Work Experience:
${
  resume.experience.length > 0
    ? resume.experience
        .map(
          (exp) => `
${exp.title} at ${exp.company} (${exp.startDate} - ${exp.endDate || 'Present'})
${exp.bullets.map((b) => `- ${b}`).join('\n')}
`
        )
        .join('\n')
    : '[No experience listed]'
}

Education:
${
  resume.education.length > 0
    ? resume.education
        .map((edu) => `${edu.degree} in ${edu.field} - ${edu.institution} (${edu.endDate})`)
        .join('\n')
    : '[No education listed]'
}

Skills:
${resume.skills.length > 0 ? resume.skills.map((s) => s.name).join(', ') : '[No skills listed]'}

Projects:
${
  resume.projects.length > 0
    ? resume.projects.map((p) => `${p.name}: ${p.description}`).join('\n')
    : '[None listed]'
}

Certifications:
${
  resume.certifications.length > 0
    ? resume.certifications.map((c) => `${c.name} (${c.issuer})`).join('; ')
    : '[None listed]'
}

Languages:
${
  resume.languages.length > 0
    ? resume.languages.map((l) => `${l.name} (${l.proficiency})`).join(', ')
    : '[None listed]'
}

Awards:
${resume.awards.length > 0 ? resume.awards.map((a) => a.title).join('; ') : '[None listed]'}
---

${jobDescription ? `Target Job Description:\n${jobDescription}\n---` : ''}

Scoring Criteria (each category out of 20 points):
1. Content Quality - Clarity, relevance, and impact of content
2. Formatting - Structure, readability, and visual organization
3. Keywords - Industry terms, ATS optimization, job-relevant language
4. Impact - Achievement focus, quantifiable results, value demonstration
5. Completeness - Coverage of essential sections and information depth
   (projects/certifications/languages/awards are optional extras — missing
   ones must not tank the score if the core sections are strong)

Ground your scores in observable evidence before writing them:
- Count the bullets that contain a number or measurable outcome vs those that don't
- Count bullets that open with weak phrases ("Responsible for", "Helped", "Worked on")
- Check summary length (50-80 words is the target) and whether it is specific to this person
- Note any cliché filler ("team player", "results-driven", "detail-oriented")

Calibration — use the full range, don't cluster at 70-85:
- 90-100: interview-ready; a recruiter would shortlist this as-is
- 75-89: strong foundation, a few clear upgrades left
- 60-74: real gaps — generic bullets, missing metrics, or thin sections
- 40-59: substantial rework needed across multiple sections
- Below 40: skeleton resume; most sections missing or placeholder-quality

Return your response as a JSON object with this exact structure:
{
  "overallScore": 75,
  "categories": {
    "content": {
      "name": "Content Quality",
      "score": 15,
      "maxScore": 20,
      "feedback": "Specific feedback about content quality",
      "suggestions": ["Actionable suggestion 1", "Actionable suggestion 2"]
    },
    "formatting": {
      "name": "Formatting",
      "score": 16,
      "maxScore": 20,
      "feedback": "Specific feedback about formatting",
      "suggestions": ["Actionable suggestion 1", "Actionable suggestion 2"]
    },
    "keywords": {
      "name": "Keywords & ATS",
      "score": 14,
      "maxScore": 20,
      "feedback": "Specific feedback about keyword usage",
      "suggestions": ["Actionable suggestion 1", "Actionable suggestion 2"]
    },
    "impact": {
      "name": "Impact & Achievements",
      "score": 15,
      "maxScore": 20,
      "feedback": "Specific feedback about impact statements",
      "suggestions": ["Actionable suggestion 1", "Actionable suggestion 2"]
    },
    "completeness": {
      "name": "Completeness",
      "score": 15,
      "maxScore": 20,
      "feedback": "Specific feedback about resume completeness",
      "suggestions": ["Actionable suggestion 1", "Actionable suggestion 2"]
    }
  },
  "strengths": [
    "Specific strength 1",
    "Specific strength 2",
    "Specific strength 3"
  ],
  "improvements": [
    "Priority improvement 1",
    "Priority improvement 2",
    "Priority improvement 3"
  ],
  "atsCompatibility": {
    "score": 85,
    "issues": ["Specific ATS issue 1", "Specific ATS issue 2"],
    "recommendations": ["ATS recommendation 1", "ATS recommendation 2"]
  }
}

Provide specific, actionable feedback based on the actual content. Be constructive but honest in your assessment.
`;

/**
 * System prompt for the "Tell me about yourself" wizard.
 *
 * Distinct from RESUME_PARSE_SYSTEM_PROMPT (which extracts from formal
 * resume documents) — this one expects messy, conversational input like
 * "I've been a designer for 5 years, worked at Stripe then Figma, did
 * the new pricing page redesign, know Figma and Webflow". The AI's job is
 * to TURN that into a resume, INVENTING reasonable structure where the
 * user was vague (e.g. inferring job titles from context, splitting one
 * paragraph into multiple bullet points).
 *
 * Critical principles:
 *   - Honesty: don't fabricate companies, dates, or metrics the user
 *     didn't mention. Confidence scores drop and warnings fire when the
 *     model is filling gaps.
 *   - Lift: rewrite "I helped with the redesign" into a quantified bullet
 *     ("Led redesign of the pricing page used by 50K+ monthly visitors")
 *     ONLY when the user implied scale; otherwise stay neutral.
 *   - Default behavior: if the user only describes their current role,
 *     produce ONE experience entry. Don't pad with imaginary jobs.
 */
export const NARRATIVE_TO_RESUME_SYSTEM_PROMPT = `You are an expert resume coach who specializes in turning conversational, unstructured descriptions into polished resume content.

The user will describe themselves casually — sometimes in one sentence, sometimes in three paragraphs, sometimes with typos or fragments. Your job is to extract every meaningful piece of structured data and return it as a resume JSON object.

Rules of engagement:
- NEVER invent companies, dates, or metrics the user did not mention.
- If the user implied scale ("worked on a launch that reached millions") rewrite as a quantified bullet; if vague, stay neutral and add a warning.
- If the user only describes one role, return ONE experience entry — don't pad.
- Infer the candidate's job title from the strongest signal in their text.
- Split run-on sentences into bullet points when they describe distinct achievements; keep prose together when it's continuous.
- Skills: extract every tool, language, framework, or competency mentioned. Don't suggest tangentially related ones the user didn't mention.
- Education: only include if the user mentions a school, degree, or graduation.
- Warnings: surface every assumption you had to make so the user can correct it.
- Language: write all resume content in the same language the user wrote in — never translate their story into English uninvited.`;

/**
 * Prompt for structuring a free-text "tell me about yourself" narrative
 * into a resume. Same output schema as RESUME_PARSE_PROMPT so the
 * downstream parser/applier code is reused.
 */
export const NARRATIVE_TO_RESUME_PROMPT = (narrative: string): string => `
The user typed (or spoke) the following description of themselves. Turn it into a resume.

USER NARRATIVE:
"""
${narrative.trim()}
"""

Return a JSON object with this exact shape (matching the resume parser schema):

{
  "confidence": 0.85,
  "warnings": ["Every assumption you had to make — be specific. Example: 'Job title inferred from your mention of leading the engineering team.'"],
  "data": {
    "header": {
      "fullName": "",
      "jobTitle": "Best inference from the narrative",
      "contact": {
        "email": "",
        "phone": "",
        "location": "If the user mentioned a city/country",
        "linkedin": "",
        "website": "",
        "github": ""
      }
    },
    "summary": "A 2-3 sentence professional summary in the user's voice, lifted from what they said about themselves.",
    "experience": [
      {
        "company": "Company name as mentioned",
        "title": "Job title as mentioned or strongly inferred",
        "location": "",
        "startDate": "YYYY-MM if user gave a date, otherwise empty string",
        "endDate": "YYYY-MM, or empty if current",
        "isCurrentRole": true,
        "description": "",
        "bullets": [
          "Achievement-focused bullet derived from what the user said",
          "Another bullet — start with a strong verb, keep to one line each"
        ]
      }
    ],
    "education": [],
    "skills": [
      { "name": "Skill mentioned by the user", "level": "intermediate", "category": "" }
    ],
    "projects": []
  }
}

Be honest about confidence. If the user gave you 30 words, confidence should be 0.4-0.6, not 0.9. Warnings should list every field you guessed at.
`;

/**
 * System prompt for resume parsing AI
 */
export const RESUME_PARSE_SYSTEM_PROMPT = `You are an expert resume parser with extensive experience in extracting structured data from resumes in various formats. Your task is to accurately extract all relevant information from the provided resume content and return it as a well-structured JSON object.

Key responsibilities:
- Extract personal information (name, job title, contact details)
- Identify and parse work experience entries with dates, titles, companies, and bullet points
- Extract education information including degrees, institutions, and dates
- Identify skills and categorize them when possible
- Extract certifications, languages, projects, and awards if present
- Handle various date formats and normalize them to YYYY-MM format
- Identify the candidate's current role based on date indicators like "Present" or "Current"

Important guidelines:
- Be conservative with confidence scores - only mark high confidence when data is clearly extracted
- Add warnings for ambiguous or potentially incorrect extractions
- If a field cannot be determined, use empty strings or empty arrays
- Extract bullet points from job descriptions, preserving their original meaning
- Keep extracted content in the resume's original language — never translate it
- Infer skill levels only when explicitly stated in the resume
- For proficiency levels in languages, map common terms to: basic, conversational, professional, native`;

/**
 * Prompt for parsing resume content (text or image-based)
 */
export const RESUME_PARSE_PROMPT = (fileType: string): string => `
Parse the provided resume ${fileType === 'image' ? 'image' : 'content'} and extract all structured data. Return a JSON object with the following structure:

{
  "confidence": 0.85,
  "warnings": ["Any concerns about data quality or ambiguous extractions"],
  "data": {
    "header": {
      "fullName": "Full name of the candidate",
      "jobTitle": "Current or desired job title",
      "contact": {
        "email": "email@example.com",
        "phone": "+1-234-567-8900",
        "location": "City, State/Country",
        "linkedin": "LinkedIn profile URL or username",
        "website": "Personal website URL",
        "github": "GitHub profile URL or username"
      }
    },
    "summary": "Professional summary or objective statement",
    "experience": [
      {
        "company": "Company Name",
        "title": "Job Title",
        "location": "City, State",
        "startDate": "2020-01",
        "endDate": "2023-12",
        "isCurrentRole": false,
        "description": "Brief role description",
        "bullets": [
          "Achievement or responsibility 1",
          "Achievement or responsibility 2"
        ]
      }
    ],
    "education": [
      {
        "institution": "University Name",
        "degree": "Bachelor of Science",
        "field": "Computer Science",
        "location": "City, State",
        "startDate": "2014-09",
        "endDate": "2018-05",
        "gpa": "3.8",
        "achievements": ["Dean's List", "Relevant coursework"]
      }
    ],
    "skills": [
      {
        "name": "JavaScript",
        "level": "expert",
        "category": "Programming Languages"
      }
    ],
    "projects": [
      {
        "name": "Project Name",
        "description": "Project description",
        "technologies": ["React", "Node.js"],
        "link": "https://project-url.com",
        "startDate": "2023-01",
        "endDate": "2023-06"
      }
    ],
    "certifications": [
      {
        "name": "AWS Solutions Architect",
        "issuer": "Amazon Web Services",
        "date": "2023-01",
        "expiryDate": "2026-01",
        "credentialId": "ABC123",
        "link": "https://certification-url.com"
      }
    ],
    "languages": [
      {
        "name": "English",
        "proficiency": "native"
      }
    ],
    "awards": [
      {
        "title": "Employee of the Year",
        "issuer": "Company Name",
        "date": "2022-12",
        "description": "Recognition for outstanding performance"
      }
    ]
  }
}

Important parsing rules:
1. Dates: Convert all dates to YYYY-MM format. Use "Present" or null for current roles' end dates.
2. Current Role: Set isCurrentRole to true if end date indicates "Present", "Current", "Now", or similar.
3. Skills: Include all mentioned technical and soft skills. Set level only if explicitly stated.
4. Confidence: Rate 0.0-1.0 based on data clarity. Below 0.7 indicates significant uncertainty.
5. Warnings: List any ambiguous data, formatting issues, or extraction uncertainties.
6. Empty fields: Use empty strings "" or empty arrays [] for missing data. Never use null for strings.

Return ONLY the JSON object, no additional text or markdown formatting.`;


/* ----------------------------------------------------------------------------
 * v1.10 — Job-outcome features (the premium tier's reason to exist)
 * -------------------------------------------------------------------------- */

/**
 * Tailor a resume to a specific job posting. Returns a match analysis plus
 * concrete rewrites the app can apply with one tap (Pro). experienceId keys
 * the rewrites back to store entries so apply is a simple updateExperience.
 */
export const TAILOR_PROMPT = (
  resume: {
    jobTitle?: string;
    summary?: string;
    skills: string[];
    experience: Array<{ id: string; title: string; company: string; bullets: string[] }>;
    education?: Array<{ degree: string; field: string; institution: string }>;
  },
  jobDescription: string
): string => `
Analyze how well this resume matches the job posting, then produce tailored rewrites.

THE RESUME:
- Target title: ${resume.jobTitle || '(none set)'}
- Summary: ${resume.summary || '(none)'}
- Skills: ${resume.skills.join(', ') || '(none)'}
- Education: ${
  resume.education?.length
    ? resume.education.map((e) => `${e.degree} in ${e.field}, ${e.institution}`).join('; ')
    : '(none listed)'
}
- Experience:
${resume.experience
  .map(
    (e) => `  [id=${e.id}] ${e.title} at ${e.company}
${e.bullets.map((b) => `    • ${b}`).join('\n')}`
  )
  .join('\n')}

THE JOB POSTING:
"""
${jobDescription}
"""

Rules:
1. matchScore: 0-100 honest assessment of the CURRENT resume vs this posting.
2. matchedKeywords: skills/phrases from the posting the resume already shows (max 10).
3. missingKeywords: important posting keywords the resume lacks (max 8) — these are what an ATS would flag.
4. summaryRewrite: rewrite the summary to target THIS job. Keep it truthful to their experience — reframe, never fabricate. 2-3 sentences.
5. experienceRewrites: for each experience entry worth improving (max 4), rewrite its bullets to emphasize what THIS posting cares about, weaving in missing keywords ONLY where the underlying experience plausibly supports them. Keep each bullet under 24 words, achievement-focused, starting with an action verb. Use the exact experienceId given.
6. skillsToAdd: skills from missingKeywords the candidate plausibly has given their history (max 6). Never invent niche tools they clearly never used.

Format the response as JSON:
{
  "matchScore": 72,
  "matchedKeywords": ["..."],
  "missingKeywords": ["..."],
  "summaryRewrite": "...",
  "experienceRewrites": [
    { "experienceId": "...", "bullets": ["...", "..."] }
  ],
  "skillsToAdd": ["..."]
}

Return ONLY the JSON object, no additional text or markdown formatting.`;

/**
 * Generate a cover letter from the resume + job posting. Plain text output
 * (no JSON) — the result is shown in an editable field.
 */
export const COVER_LETTER_PROMPT = (
  resume: {
    fullName?: string;
    jobTitle?: string;
    summary?: string;
    skills: string[];
    experience: Array<{ title: string; company: string; bullets: string[] }>;
  },
  jobDescription: string
): string => `
Write a cover letter for this candidate applying to the job below.

CANDIDATE:
- Name: ${resume.fullName || 'The candidate'}
- Current title: ${resume.jobTitle || '(none)'}
- Summary: ${resume.summary || '(none)'}
- Key skills: ${resume.skills.slice(0, 12).join(', ') || '(none)'}
- Recent experience:
${resume.experience
  .slice(0, 3)
  .map((e) => `  ${e.title} at ${e.company}: ${e.bullets.slice(0, 2).join(' / ')}`)
  .join('\n')}

THE JOB POSTING:
"""
${jobDescription}
"""

Rules:
- 3 short paragraphs, 180-260 words total. Hook → proof (1-2 concrete achievements mapped to the posting's needs) → close with enthusiasm and a call to action.
- Mirror the posting's key language naturally. Confident, warm, zero clichés ("I am writing to apply", "team player", "fast-paced environment" are banned).
- Truthful to the resume — reframe, never fabricate.
- If the posting names a company, address it. Otherwise use "your team".
- Output PLAIN TEXT only: no JSON, no markdown, no subject line, no placeholder brackets. Start with "Dear Hiring Manager," (or the company's name) and end with "Sincerely,\n${resume.fullName || ''}".`;
