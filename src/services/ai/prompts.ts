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
