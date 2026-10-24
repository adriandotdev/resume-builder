import { CURRENT_VERSION, DEFAULT_STYLE, type ResumeDoc } from "./schema";

/** Fictional sample person and original wording, used for thumbnails and first run. */
export function createSampleDoc(): ResumeDoc {
  return {
    version: CURRENT_VERSION,
    style: { ...DEFAULT_STYLE },
    sections: [
      {
        id: "s-contact", type: "contact", title: "Contact", visible: true,
        content: {
          fullName: "Elena Marchetti",
          headline: "Operations Analyst",
          email: "elena.marchetti@example.com",
          phone: "+1 555 0142",
          location: "Portland, OR",
          links: ["example.com/elena"],
        },
      },
      {
        id: "s-summary", type: "summary", title: "Summary", visible: true,
        content: { text: "Operations analyst with six years of experience turning messy process data into clear weekly decisions. Comfortable with spreadsheets, SQL and plain-language reporting for non-technical teams." },
      },
      {
        id: "s-exp", type: "experience", title: "Experience", visible: true,
        content: {
          items: [
            {
              id: "e1", role: "Senior Operations Analyst", org: "Harborline Logistics", location: "Portland, OR",
              start: "2022-03", end: "", current: true,
              bullets: [
                "Built a weekly delivery-delay report that cut manual reporting time from six hours to one.",
                "Led a pilot of route batching with three depots, reducing late arrivals by 14 percent.",
                "Trained 12 coordinators to read dashboards and flag exceptions before they escalate.",
              ],
            },
            {
              id: "e2", role: "Operations Analyst", org: "Brightwell Supplies", location: "Seattle, WA",
              start: "2019-06", end: "2022-02", current: false,
              bullets: [
                "Reconciled inventory counts across four warehouses and cut stock discrepancies by a third.",
                "Documented 20 standard operating procedures used during onboarding.",
              ],
            },
          ],
        },
      },
      {
        id: "s-edu", type: "education", title: "Education", visible: true,
        content: { items: [{ id: "d1", degree: "B.S. in Business Administration", school: "Cascade State University", location: "Eugene, OR", start: "2015-09", end: "2019-05", details: ["Minor in Statistics; graduated with honors."] }] },
      },
      {
        id: "s-skills", type: "skills", title: "Skills", visible: true,
        content: {
          items: [
            { id: "k1", label: "Analysis", skills: "SQL, Excel, forecasting, root-cause analysis" },
            { id: "k2", label: "Tools", skills: "Looker, Airtable, Jira, Google Sheets" },
          ],
        },
      },
      {
        id: "s-proj", type: "projects", title: "Projects", visible: true,
        content: { items: [{ id: "p1", name: "Depot Capacity Planner", link: "example.com/planner", start: "2023-01", end: "2023-06", bullets: ["Open spreadsheet template that estimates weekly dock capacity from three inputs."] }] },
      },
      {
        id: "s-cert", type: "certifications", title: "Certifications", visible: true,
        content: { items: [{ id: "c1", name: "Lean Six Sigma Green Belt", issuer: "Example Quality Institute", date: "2021-04" }] },
      },
      {
        id: "s-lang", type: "languages", title: "Languages", visible: true,
        content: { items: [{ id: "l1", name: "English", level: "Native" }, { id: "l2", name: "Italian", level: "Professional working" }] },
      },
    ],
  };
}
