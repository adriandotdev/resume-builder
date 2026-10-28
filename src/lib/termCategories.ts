import { canonicalKey, phraseKey } from "./jobmatch";

export const CATEGORIES = ["Languages", "Frameworks & libraries", "Cloud & DevOps", "Data & databases", "Tools", "Practices", "Soft skills", "Other"] as const;
export type TermCategory = (typeof CATEGORIES)[number];

/** Hand-written, English only. A term not listed here (or built from a listed word) falls under "Other". */
const LISTED: Record<Exclude<TermCategory, "Other">, string[]> = {
  Languages: ["Python", "Java", "JavaScript", "TypeScript", "Golang", "Rust", "C", "C++", "C#", "R", "PHP", "Ruby", "Swift", "Kotlin", "Scala", "SQL", "Bash", "HTML", "CSS", "Perl", "Dart", "MATLAB"],
  "Frameworks & libraries": ["React", "Vue", "Angular", "Next.js", "Node.js", "Django", "Flask", "FastAPI", "Spring", "Express", "Rails", "Laravel", ".NET", "ASP.NET", "Tailwind", "jQuery", "Redux", "Pandas", "NumPy", "PyTorch", "TensorFlow", "Svelte", "GraphQL", "Application programming interface", "REST"],
  "Cloud & DevOps": ["Amazon Web Services", "Azure", "Google Cloud Platform", "Kubernetes", "Docker", "Terraform", "Ansible", "CI/CD", "Jenkins", "Linux", "Infrastructure as code", "DevOps", "GitHub Actions", "Helm", "Serverless"],
  "Data & databases": ["PostgreSQL", "MySQL", "MongoDB", "Redis", "Microsoft SQL Server", "Elasticsearch", "Snowflake", "BigQuery", "Spark", "Kafka", "Extract transform load", "Data warehouse", "Tableau", "Power BI", "Looker", "Excel", "Machine learning", "Natural language processing", "Data analysis", "Data modeling", "Data visualization", "Statistics"],
  Tools: ["Git", "GitHub", "GitLab", "Jira", "Confluence", "Figma", "Slack", "Salesforce", "Customer relationship management", "Enterprise resource planning", "SAP", "Photoshop", "Postman", "Notion", "Zendesk"],
  Practices: ["Agile", "Scrum", "Kanban", "Test-driven development", "Code review", "Testing", "Unit testing", "A/B testing", "Project management", "Stakeholder management", "User experience", "User interface", "Search engine optimization", "Key performance indicators", "Software development life cycle", "Object-oriented programming", "Microservices", "Accessibility", "Budgeting", "Forecasting"],
  "Soft skills": ["Communication", "Leadership", "Collaboration", "Problem solving", "Teamwork", "Mentoring", "Time management", "Critical thinking", "Adaptability", "Negotiation", "Presentation", "Organization", "Creativity"],
};

const CATEGORY_OF = new Map<string, TermCategory>();
for (const [category, phrases] of Object.entries(LISTED) as [TermCategory, string[]][]) {
  for (const phrase of phrases) CATEGORY_OF.set(canonicalKey(phraseKey(phrase)), category);
}

/** The category of a term as the posting wrote it. Tries the whole phrase first, then each word ("react native" is a framework). */
export function categoryOf(term: string): TermCategory {
  const whole = CATEGORY_OF.get(canonicalKey(phraseKey(term)));
  if (whole) return whole;
  for (const word of phraseKey(term).split(" ")) {
    const hit = word !== phraseKey(term) && CATEGORY_OF.get(canonicalKey(word));
    if (hit) return hit;
  }
  return "Other";
}

/** Items grouped by category in the order of CATEGORIES, skipping empty categories. Order within a category is kept. */
export function groupByCategory<T extends { term: string }>(items: T[]): { category: TermCategory; items: T[] }[] {
  const groups = new Map<TermCategory, T[]>();
  for (const item of items) {
    const c = categoryOf(item.term);
    groups.set(c, [...(groups.get(c) ?? []), item]);
  }
  return CATEGORIES.filter((c) => groups.has(c)).map((category) => ({ category, items: groups.get(category)! }));
}
