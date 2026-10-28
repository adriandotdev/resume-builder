import { describe, expect, it } from "vitest";
import { categoryOf, CATEGORIES, groupByCategory } from "@/lib/termCategories";

describe("categoryOf", () => {
  it("files listed terms under their category", () => {
    expect(categoryOf("Python")).toBe("Languages");
    expect(categoryOf("React")).toBe("Frameworks & libraries");
    expect(categoryOf("Docker")).toBe("Cloud & DevOps");
    expect(categoryOf("PostgreSQL")).toBe("Data & databases");
    expect(categoryOf("Jira")).toBe("Tools");
    expect(categoryOf("Agile")).toBe("Practices");
    expect(categoryOf("Leadership")).toBe("Soft skills");
  });
  it("treats every spelling of a skill alike", () => {
    expect(categoryOf("k8s")).toBe("Cloud & DevOps");
    expect(categoryOf("Postgres")).toBe(categoryOf("PostgreSQL"));
    expect(categoryOf("CI/CD")).toBe(categoryOf("continuous integration"));
  });
  it("is case-insensitive and reads plurals", () => {
    expect(categoryOf("PYTHON")).toBe("Languages");
    expect(categoryOf("dashboards")).toBe("Other");
  });
  it("falls back to a word of the phrase, then to Other", () => {
    expect(categoryOf("React Native")).toBe("Frameworks & libraries");
    expect(categoryOf("Six Sigma")).toBe("Other");
    expect(categoryOf("")).toBe("Other");
  });
});

describe("groupByCategory", () => {
  const items = [{ term: "Agile" }, { term: "Python" }, { term: "Six Sigma" }, { term: "Java" }];
  it("orders groups like CATEGORIES and keeps the order inside a group", () => {
    const g = groupByCategory(items);
    expect(g.map((x) => x.category)).toEqual(["Languages", "Practices", "Other"]);
    expect(g[0].items.map((x) => x.term)).toEqual(["Python", "Java"]);
    expect(g.map((x) => x.category)).toEqual(CATEGORIES.filter((c) => g.some((x) => x.category === c)));
  });
  it("skips empty categories and loses no item", () => {
    expect(groupByCategory([])).toEqual([]);
    expect(groupByCategory(items).flatMap((x) => x.items)).toHaveLength(items.length);
  });
});
