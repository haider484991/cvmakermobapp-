import type { AIContext, Resume } from '@/types';

/**
 * System prompt establishing the AI's role and expertise
 */
export const SYSTEM_PROMPT = `You are an expert resume writer and career coach with over 15 years of experience helping professionals across various industries land their dream jobs. You specialize in:

- Crafting compelling professional summaries that highlight unique value propositions
- Transforming job descriptions into impactful, achievement-focused bullet points
- Identifying relevant skills and keywords for ATS optimization
- Providing actionable feedback to improve resume quality

Your responses should be professional, specific, and tailored to the individual's career goals and industry. Always prioritize clarity, impact, and authenticity in your suggestions.`;

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
Generate 3 distinct professional summary options for a resume. Each summary should be:
- 3-4 sentences long (50-80 words)
- Written in first person without using "I"
- Achievement-oriented and quantifiable where possible
- Tailored to the candidate's background and target role
- ATS-friendly with relevant keywords

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

Each summary should have a different focus:
1. Leadership/management oriented
2. Technical/skills oriented
3. Results/achievement oriented

Ensure each summary is unique, compelling, and showcases the candidate's value proposition.
`;

/**
 * Prompt for enhancing experience bullet points
 */
export const BULLET_POINT_PROMPT = (
  bullets: string[],
  context: Partial<AIContext>
): string => `
Transform the following job description bullet points into powerful, achievement-focused statements using the STAR (Situation, Task, Action, Result) or XYZ (Accomplished X by doing Y, resulting in Z) format.

Guidelines for enhancement:
- Start each bullet with a strong action verb
- Include quantifiable metrics where possible (%, $, #)
- Focus on impact and results, not just responsibilities
- Keep bullets concise (1-2 lines, under 20 words ideal)
- Use industry-relevant keywords for ATS optimization
- Maintain authenticity - enhance, don't fabricate

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
---

${jobDescription ? `Target Job Description:\n${jobDescription}\n---` : ''}

Scoring Criteria (each category out of 20 points):
1. Content Quality - Clarity, relevance, and impact of content
2. Formatting - Structure, readability, and visual organization
3. Keywords - Industry terms, ATS optimization, job-relevant language
4. Impact - Achievement focus, quantifiable results, value demonstration
5. Completeness - Coverage of essential sections and information depth

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
 * Prompt for generating a single quick suggestion
 */
export const QUICK_SUGGESTION_PROMPT = (
  type: 'summary' | 'bullet' | 'skill',
  content: string,
  context?: Partial<AIContext>
): string => {
  const contextStr = context
    ? `Context: ${context.jobTitle || ''} ${context.industry ? `in ${context.industry}` : ''}`
    : '';

  switch (type) {
    case 'summary':
      return `
Improve this professional summary to be more impactful and ATS-friendly:

"${content}"

${contextStr}

Return only the improved summary text, no explanation needed. Keep it 3-4 sentences.
`;

    case 'bullet':
      return `
Transform this job responsibility into an achievement-focused bullet point:

"${content}"

${contextStr}

Return only the improved bullet point, starting with a strong action verb. Include metrics if possible.
`;

    case 'skill':
      return `
Based on this context, suggest ONE highly relevant skill to add:

${content}

${contextStr}

Return only the skill name, nothing else.
`;
  }
};

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
- Warnings: surface every assumption you had to make so the user can correct it.`;

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

