import { describe, expect, it } from "vitest";
import { extractTerms, matchJobDescription, MAX_JD_CHARS, normalize, stem, tokenize } from "@/lib/jobmatch";
import { createSampleDoc } from "@/lib/sample";
import type { ResumeDoc, SkillsSection } from "@/lib/schema";
import { APP_DEVELOPER, DATA_ENGINEER, FRONTEND, NURSE, OPS_ANALYST } from "./fixtures/postings";

// Selection tests compare lowercase; the casing of terms has its own tests.
const terms = (jd: string) => extractTerms(jd).map((t) => t.term.toLowerCase());
const skills = (d: ResumeDoc) => d.sections.find((s) => s.type === "skills") as SkillsSection;
const sorted = (xs: string[]) => [...xs].sort();
const split = (doc: ResumeDoc, jd: string) => {
  const m = matchJobDescription(doc, jd).terms;
  return { found: sorted(m.filter((t) => t.found).map((t) => t.term.toLowerCase())), missing: sorted(m.filter((t) => !t.found).map((t) => t.term.toLowerCase())) };
};

describe("normalize, tokenize, stem", () => {
  it("unifies case, quotes and dashes and drops apostrophes inside words", () => {
    expect(normalize("Bachelor’s – Ｄｅｇｒｅｅ")).toBe("bachelors - degree");
  });
  it("keeps technology tokens whole", () => {
    expect(tokenize("c++ c# .net node.js ci/cd a/b asp.net root-cause")).toEqual(["c++", "c#", ".net", "node.js", "ci/cd", "a/b", "asp.net", "root-cause"]);
  });
  it("trims light suffixes and leaves short words and symbol tokens alone", () => {
    expect(new Set(["managed", "management", "managing", "manages", "manage"].map(stem)).size).toBe(1);
    expect(stem("reports")).toBe(stem("reporting"));
    expect(stem("process")).toBe("process");
    for (const t of ["data", "sql", "node.js", "c++", "ci/cd"]) expect(stem(t)).toBe(t);
  });
});

describe("extractTerms", () => {
  it("removes stopwords and posting filler", () => {
    const t = terms("We are looking for a strong team with the ability to work. Years of experience required. Responsibilities include Kubernetes.");
    expect(t).toEqual(["kubernetes"]);
  });
  it("keeps tech tokens whole", () => {
    const t = terms("Skills: C++, C#, .NET, Node.js and CI/CD pipelines. A/B testing. A/B testing.");
    expect(t).toEqual(expect.arrayContaining(["c++", "c#", ".net", "node.js", "ci/cd", "a/b testing"]));
  });
  it("prefers a phrase over the single words it contains", () => {
    const t = terms("Machine learning models. Machine learning in production.");
    expect(t).toContain("machine learning");
    expect(t).not.toContain("machine");
    expect(t).not.toContain("learning");
  });
  it("keeps a single word that also appears outside the phrase", () => {
    const t = terms("Python scripting is required. Python scripting daily. We also use Python for tests.");
    expect(t).toContain("python scripting");
    expect(t).toContain("python");
  });
  it("never starts or ends a phrase on a stopword, or spans punctuation", () => {
    for (const term of terms(OPS_ANALYST + DATA_ENGINEER)) expect(term).not.toMatch(/^(and|or|of|the|to|with|in|for) |( and| or| of| the| to| with| in| for)$/);
    expect(terms("Excel, SQL. Excel, SQL.")).toEqual(expect.not.arrayContaining(["excel sql", "sql excel"]));
  });
  it("keeps the casing the posting used", () => {
    const t = extractTerms("Requirements:\n- AWS and Node.js\n- iOS, CI/CD and JavaScript\n- .NET and C++").map((x) => x.term);
    expect(t).toEqual(expect.arrayContaining(["AWS", "Node.js", "iOS", "CI/CD", "JavaScript", ".NET", "C++"]));
  });
  it("uses the most common spelling of a term", () => {
    expect(extractTerms("python python Python")[0].term).toBe("python");
  });
  it("ranks repeated and requirement terms first and keeps at most 25", () => {
    const t = extractTerms(OPS_ANALYST);
    expect(t.length).toBeLessThanOrEqual(25);
    expect(t.map((x) => x.weight)).toEqual([...t.map((x) => x.weight)].sort((a, b) => b - a));
    expect(extractTerms("Zebra. Sql. Sql. Sql.")[0].term).toBe("Sql");
    const many = Array.from({ length: 80 }, (_, i) => `word${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}x`).join(" ");
    expect(extractTerms(many).length).toBe(25);
  });
  it("returns nothing for empty input or input made only of stopwords", () => {
    expect(extractTerms("")).toEqual([]);
    expect(extractTerms("   \n\n  ")).toEqual([]);
    expect(extractTerms("The and of to with experience years team strong ability 5+ 10")).toEqual([]);
  });
  it("reads only the first 20,000 characters", () => {
    const pad = "the ".repeat(MAX_JD_CHARS / 4);
    expect(pad.length).toBe(MAX_JD_CHARS);
    expect(terms(pad + "kubernetes kubernetes")).toEqual([]);
    expect(terms("kubernetes " + pad)).toEqual(["kubernetes"]);
  });
});

describe("matchJobDescription", () => {
  it("matches across word forms (managed ↔ management) and reports the section", () => {
    const d = createSampleDoc();
    skills(d).content.items[0].skills = "vendor managed";
    const r = matchJobDescription(d, "Vendor management is key. Vendor management reporting.").terms;
    const vm = r.find((t) => t.term.toLowerCase() === "vendor management");
    expect(vm).toMatchObject({ found: true, where: ["Skills"], hiddenOnly: false });
  });
  it("needs the words of a phrase next to each other, inside one line of the resume", () => {
    const d = createSampleDoc();
    skills(d).content.items = [{ id: "k1", label: "Tools", skills: "Looker, root, cause" }];
    const r = matchJobDescription(d, "Root cause analysis. Root cause analysis.").terms;
    expect(r.find((t) => t.term.toLowerCase() === "root cause analysis")?.found).toBe(false);
  });
  it("does not count a section heading as a match", () => {
    const d = createSampleDoc();
    const r = matchJobDescription(d, "Projects delivered. Projects delivered. Education tooling. Education tooling.").terms;
    expect(r.find((t) => t.term.toLowerCase() === "projects")?.found).toBeFalsy();
  });
  it("flags a term found only in a hidden section", () => {
    const d = createSampleDoc();
    skills(d).content.items = [{ id: "k1", label: "Tools", skills: "Kubernetes" }];
    const jd = "Kubernetes required. Kubernetes daily.";
    expect(matchJobDescription(d, jd).terms.find((t) => t.term.toLowerCase() === "kubernetes")).toMatchObject({ found: true, hiddenOnly: false });
    skills(d).visible = false;
    expect(matchJobDescription(d, jd).terms.find((t) => t.term.toLowerCase() === "kubernetes")).toEqual({ term: "Kubernetes", found: false, where: [], hiddenOnly: true });
  });
  it("lists every visible section a term appears in, once each", () => {
    const d = createSampleDoc();
    const r = matchJobDescription(d, "SQL analyst. SQL reports.").terms.find((t) => t.term.toLowerCase() === "sql");
    expect(r?.where).toEqual(["Summary", "Skills"]);
  });
  it("returns no terms for an empty posting", () => {
    expect(matchJobDescription(createSampleDoc(), "")).toEqual({ terms: [] });
  });

  describe("fictional postings against the sample doc", () => {
    it("operations analyst", () => {
      expect(split(createSampleDoc(), OPS_ANALYST)).toEqual({
        found: ["business", "dashboards", "data", "depot", "excel", "looker", "operations", "operations analyst", "process", "reports", "sql", "statistics", "weekly"],
        missing: ["bachelors degree", "communication", "delay", "delivery", "field", "improvements", "manage", "managers", "recommend", "stakeholder management", "supply chain analysis", "tableau"],
      });
    });
    it("data engineer", () => {
      const r = split(createSampleDoc(), DATA_ENGINEER);
      expect(r.found).toEqual(["data", "hours", "senior", "sql"]);
      expect(r.missing).toEqual(expect.arrayContaining(["python", "kubernetes", "docker", "ci/cd", "machine learning", "data pipelines", "infrastructure as code", "terraform"]));
    });
    it("a posting with a logistics header keeps skills and drops schedule, location and salary", () => {
      const t = terms(APP_DEVELOPER);
      expect(t).toEqual(expect.arrayContaining(["reactjs", "redux", "git", "java", "state management", "version control", "spring apis", "metadata-driven ui development"]));
      for (const noise of ["days", "full", "home", "hybrid", "onsite", "location", "setup", "set-up", "php", "least", "basic"]) expect(t).not.toContain(noise);
      expect(split(createSampleDoc(), APP_DEVELOPER).found).toEqual([]);
    });
    it("nurse and frontend postings share nothing with the sample doc", () => {
      expect(split(createSampleDoc(), NURSE).found).toEqual([]);
      expect(split(createSampleDoc(), FRONTEND).found).toEqual([]);
    });
    it("frontend terms move to found once added to Skills", () => {
      const d = createSampleDoc();
      skills(d).content.items.push({ id: "k9", label: "Web", skills: "React, TypeScript, Next.js, Node.js, GraphQL, C++, A/B testing, WCAG accessibility standards" });
      const r = split(d, FRONTEND);
      expect(r.found).toEqual(["a/b testing", "c++", "graphql", "next.js", "node.js", "react", "typescript", "wcag accessibility standards"]);
      expect(r.missing).toEqual(["accessible", "designers", "engineer", "frontend", "interfaces", "managers", "product", "stack", "user"]);
    });
  });
});
