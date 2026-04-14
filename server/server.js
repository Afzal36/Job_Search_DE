// server.js — Job Portal Search Engine Backend
// MongoDB Full-Text Search + Indexing · Dataset-Aligned Edition
// Dataset: jobs_data.csv fields: company, category, post_link, job_description, location, date_posted, keywords
// Run: node server.js

require("dotenv").config();
const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");

const app = express();
app.use(cors({
  origin: ["https://job-search-de.vercel.app", "http://localhost:5173"],
}));
app.use(express.json());

// ─── DB Connection ─────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.DB_URL)
  .then(() => console.log("✅  MongoDB connected"))
  .catch((err) => console.error("❌  MongoDB error:", err));

// ─── Schema ────────────────────────────────────────────────────────────────────
// Fields match jobs_data.csv exactly.
// `title` is derived at import time by extracting the first job-title line
// from job_description, so it is searchable as its own field.
const JobSchema = new mongoose.Schema(
  {
    company:         { type: String, index: true },
    category:        { type: String, index: true },   // Backend | Frontend | Data | DevOps | …
    post_link:       String,
    job_description: String,
    location:        { type: String, index: true },
    location_norm:   { type: String, index: true },   // normalised for easy filtering
    date_posted:     { type: Date,   index: true },
    keywords:        [String],                        // split from CSV "Python,AWS,…"
    title:           String,                          // extracted from description
  },
  { strict: false }
);

const Job = mongoose.model("jobs", JobSchema);

// Saved-search document
const SavedSearchSchema = new mongoose.Schema({
  userId:    { type: String, required: true },
  name:      { type: String, required: true },
  params:    { type: Object, required: true },
  createdAt: { type: Date,   default: Date.now },
});
const SavedSearch = mongoose.model("saved_searches", SavedSearchSchema);

// ─── Full-Text Index ────────────────────────────────────────────────────────────
// Compound text index across every searchable field.
// Weight job_description highest because that's where the richest content lives.
Job.collection
  .createIndex(
    {
      title:           "text",
      job_description: "text",
      keywords:        "text",
      company:         "text",
      location:        "text",
      category:        "text",
    },
    {
      name: "job_text_index",
      default_language: "english",
      weights: {
        title:           10,   // boosted — most precise signal
        keywords:        8,    // skill tags are highly relevant
        category:        6,
        company:         4,
        location:        3,
        job_description: 2,
      },
    }
  )
  .catch(() => {}); // index may already exist

// ─── Helper: normalise location string ─────────────────────────────────────────
// The dataset has messy location strings; we extract a clean city/state token.
function normaliseLocation(raw = "") {
  const s = raw.toLowerCase().trim();
  if (!s || s === "remote" || s.includes("remote")) return "Remote";
  // City, State patterns
  const m = s.match(/^([a-z\s]+),\s*([a-z]{2})/);
  if (m) return `${cap(m[1].trim())}, ${m[2].toUpperCase()}`;
  return cap(s.split(/[,/|(]/)[0].trim());
}
function cap(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Helper: normalize job for frontend ─────────────────────────────────────────
// Ensures all jobs have a `skills` array (from keywords) for easy frontend display
function normalizeJobForFrontend(doc) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  return {
    ...obj,
    skills: Array.isArray(obj.keywords) ? obj.keywords.filter(Boolean) : [],
  };
}

// ─── Helper: extract title from description ────────────────────────────────────
// Tries to find a short headline line before the body text.
function extractTitle(desc = "") {
  const lines = desc
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    // Good title: 3–10 words, no URLs, not pure punctuation
    if (line.length > 5 && line.length < 120 && !line.includes("http") && /[a-zA-Z]{3}/.test(line)) {
      // Skip lines that look like boilerplate
      if (/cookie|privacy|apply|login|sign in/i.test(line)) continue;
      return line.replace(/^[-–—•*]\s*/, "");
    }
  }
  return lines[0]?.slice(0, 80) || "Job Opening";
}



// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT ROUTE (one-time use)
// POST /import  — body: { jobs: [ ...raw CSV rows ] }
// Call once from a script to seed MongoDB from the CSV.
// Each row: { company, category, post_link, job_description, location, date_posted, keywords }
// ═══════════════════════════════════════════════════════════════════════════════
app.post("/import", async (req, res) => {
  try {
    const { jobs: raw, secret } = req.body;
    if (secret !== process.env.IMPORT_SECRET)
      return res.status(403).json({ error: "Forbidden" });

    const docs = raw.map((r) => ({
      company:         r.company || "",
      category:        r.category || "Other",
      post_link:       r.post_link || "",
      job_description: r.job_description || "",
      location:        r.location || "",
      location_norm:   normaliseLocation(r.location),
      date_posted:     r.date_posted ? new Date(r.date_posted) : new Date(),
      keywords:        r.keywords
        ? r.keywords.split(",").map((k) => k.trim()).filter(Boolean)
        : [],
      title: extractTitle(r.job_description),
    }));

    await Job.insertMany(docs, { ordered: false });
    res.json({ inserted: docs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINT: Manual CSV Import Trigger
// GET /admin/import-csv?secret=YOUR_IMPORT_SECRET
// Manually trigger CSV import if auto-import failed
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/admin/import-csv", async (req, res) => {
  try {
    const { secret } = req.query;
    if (secret !== process.env.IMPORT_SECRET) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const count = await Job.countDocuments();
    if (count > 0) {
      return res.json({ message: `Database already has ${count} jobs, skipping import` });
    }

    const csvFile = path.resolve(__dirname, "jobs_data.csv");
    if (!fs.existsSync(csvFile)) {
      return res.status(404).json({ error: `CSV file not found at ${csvFile}` });
    }

    const jobs = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFile)
        .pipe(csv())
        .on("data", (row) => {
          jobs.push({
            company:         row.company || "",
            category:        row.category || "Other",
            post_link:       row.post_link || "",
            job_description: row.job_description || "",
            location:        row.location || "",
            location_norm:   normaliseLocation(row.location),
            date_posted:     row.date_posted ? new Date(row.date_posted) : new Date(),
            keywords:        row.keywords ? row.keywords.split(",").map((k) => k.trim()).filter(Boolean) : [],
            title:           extractTitle(row.job_description),
          });
        })
        .on("end", resolve)
        .on("error", reject);
    });

    if (jobs.length === 0) {
      return res.json({ message: "CSV file is empty" });
    }

    await Job.insertMany(jobs, { ordered: false });
    res.json({ message: `Successfully imported ${jobs.length} jobs!`, imported: jobs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. STANDARD FULL-TEXT + FILTER SEARCH   →   GET /search
//    Params: query, location, company, category, skills, sortBy, page, limit
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/search", async (req, res) => {
  try {
    const {
      query, location, company, category, skills,
      sortBy = "relevance", order = "desc",
      page = 1, limit = 12,
    } = req.query;

    const filter = {};
    if (query)    filter.$text        = { $search: query };
    if (location) filter.location_norm = { $regex: new RegExp(location, "i") };
    if (company)  filter.company      = { $regex: new RegExp(company, "i") };
    if (category) filter.category     = { $regex: new RegExp(category, "i") };

    if (skills) {
      const arr = skills.split(",").map((s) => s.trim()).filter(Boolean);
      // keywords array field — all must match
      filter.keywords = { $all: arr.map((s) => new RegExp(s, "i")) };
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Job.countDocuments(filter);

    const projection = query ? { score: { $meta: "textScore" } } : {};
    const sort = {};

    if (query && (sortBy === "relevance" || sortBy === "date_posted")) {
      sort.score = { $meta: "textScore" };
    } else if (sortBy === "date_posted") {
      sort.date_posted = order === "asc" ? 1 : -1;
    } else {
      sort.date_posted = -1;
    }

    const jobs = await Job.find(filter, projection)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      jobs: jobs.map(normalizeJobForFrontend),
      total,
      page: +page,
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BOOLEAN SEARCH   →   GET /search/boolean
//    must, should, not (comma-separated terms)
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/search/boolean", async (req, res) => {
  try {
    const { must, should, not, page = 1, limit = 12 } = req.query;
    const andClauses = [];

    const searchFields = (term) => [
      { title:           { $regex: term, $options: "i" } },
      { job_description: { $regex: term, $options: "i" } },
      { keywords:        { $regex: term, $options: "i" } },
    ];

    if (must) {
      must.split(",").map((t) => t.trim()).forEach((term) => {
        andClauses.push({ $or: searchFields(term) });
      });
    }
    if (should) {
      const orTerms = should.split(",").map((t) => t.trim());
      andClauses.push({ $or: orTerms.flatMap(searchFields) });
    }
    if (not) {
      not.split(",").map((t) => t.trim()).forEach((term) => {
        andClauses.push({ $nor: searchFields(term) });
      });
    }

    const filter = andClauses.length ? { $and: andClauses } : {};
    const skip   = (parseInt(page) - 1) * parseInt(limit);
    const total  = await Job.countDocuments(filter);
    const jobs   = await Job.find(filter)
      .sort({ date_posted: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      jobs: jobs.map(normalizeJobForFrontend),
      total,
      page: +page,
      pages: Math.ceil(total / parseInt(limit)),
      mode: "boolean",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. AI SEMANTIC SEARCH   →   POST /search/semantic
//    Body: { naturalQuery: "remote Python backend engineer" }
//    Groq (primary) → Heuristic rules (fallback)
// ═══════════════════════════════════════════════════════════════════════════════
app.post("/search/semantic", async (req, res) => {
  try {
    const { naturalQuery, page = 1, limit = 12 } = req.body;
    if (!naturalQuery) return res.status(400).json({ error: "naturalQuery required" });

    // Try Groq LLM, fall back to heuristic rules
    let intent;
    let extractionMethod = "unknown";
    
    try {
      console.log("[SEARCH] Processing semantic search...");
      intent = await extractIntentLLM(naturalQuery);
      extractionMethod = "Groq LLM";
      console.log("[SEARCH] ✅ Used Groq LLM for extraction");
    } catch (llmErr) {
      console.log("[SEARCH] ⚠️  LLM failed, using heuristic fallback");
      console.log("[SEARCH] Error:", llmErr.message);
      intent = extractIntentHeuristic(naturalQuery);
      extractionMethod = "Heuristic Rules";
      console.log("[SEARCH] ✅ Used heuristic rules for extraction");
    }
    
    console.log("[SEARCH] Extraction method:", extractionMethod);
    console.log("[SEARCH] Intent:", JSON.stringify(intent));

    const filter = {};
    
    // Search in keywords array (direct match for LLM-extracted keywords)
    if (intent.keywords.length) {
      filter.keywords = { 
        $in: intent.keywords.map(kw => new RegExp(kw, "i")) 
      };
      console.log("[SEARCH] Keywords filter:", filter.keywords);
    }
    
    // Match location (normalized field)
    if (intent.location) {
      filter.location_norm = { $regex: new RegExp(intent.location, "i") };
      console.log("[SEARCH] Location filter:", filter.location_norm);
    }
    
    // Match category
    if (intent.category) {
      filter.category = { $regex: new RegExp(intent.category, "i") };
      console.log("[SEARCH] Category filter:", filter.category);
    }
    
    // Match skills in keywords array
    if (intent.skills.length) {
      filter.keywords = { 
        $in: (filter.keywords?.$in || []).concat(
          intent.skills.map(s => new RegExp(s, "i"))
        )
      };
      console.log("[SEARCH] Skills filter:", filter.keywords);
    }

    console.log("[SEARCH] Final MongoDB filter:", JSON.stringify(filter));
    
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Job.countDocuments(filter);
    const jobs  = await Job.find(filter)
      .sort({ date_posted: -1 })  // Sort by most recent
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    console.log("[SEARCH] Found", total, "total jobs,", jobs.length, "on page", page);
    
    res.json({
      jobs: jobs.map(normalizeJobForFrontend),
      total,
      page: +page,
      pages: Math.ceil(total / parseInt(limit)),
      parsedIntent: intent,
      extractionMethod,
    });
  } catch (err) {
    console.log("[SEARCH] ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Heuristic NLP — aligned to dataset categories and real location patterns
function extractIntentHeuristic(text) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[HEURISTIC] Starting rule-based extraction");
  console.log("[HEURISTIC] Query:", text);
  
  const lower = text.toLowerCase();
  const intent = { keywords: [], location: null, skills: [], category: null };

  // Location: dataset is mostly US-based + Remote
  const locations = ["remote", "new york", "san francisco", "seattle", "austin", "chicago", "boston", "los angeles", "denver", "atlanta"];
  for (const loc of locations) {
    if (lower.includes(loc)) { 
      intent.location = loc === "remote" ? "Remote" : cap(loc);
      console.log("[HEURISTIC] Location found:", intent.location);
      break; 
    }
  }

  // Category: matches dataset categories
  const catMap = {
    "backend": "Backend", "back end": "Backend", "back-end": "Backend",
    "frontend": "Frontend", "front end": "Frontend", "front-end": "Frontend",
    "full stack": "Full Stack", "fullstack": "Full Stack",
    "devops": "DevOps", "sre": "DevOps",
    "data": "Data", "machine learning": "Data", "ml engineer": "Data", "data science": "Data",
    "mobile": "Mobile", "android": "Mobile", "ios": "Mobile", "react native": "Mobile",
    "sales": "Sales",
    "product manager": "PM", "product management": "PM",
    "support": "Support",
    "management": "Management",
  };
  for (const [kw, cat] of Object.entries(catMap)) {
    if (lower.includes(kw)) { 
      intent.category = cat;
      console.log("[HEURISTIC] Category found:", intent.category);
      break; 
    }
  }

  // Skills: extended list matching dataset keywords
  const knownSkills = [
    "python", "javascript", "typescript", "java", "go", "golang", "rust", "c++", "c#", "ruby", "php",
    "react", "vue", "angular", "next.js", "node", "django", "flask", "spring",
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform", "ci/cd",
    "sql", "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
    "pytorch", "tensorflow", "spark", "kafka", "graphql",
    "flutter", "kotlin", "swift", "android",
  ];
  for (const skill of knownSkills) {
    if (lower.includes(skill)) {
      intent.skills.push(skill);
      console.log("[HEURISTIC] Skill found:", skill);
    }
  }

  // Role keywords for full-text search
  const roleKW = ["engineer", "developer", "architect", "lead", "senior", "junior", "intern", "manager", "analyst", "scientist", "designer"];
  for (const kw of roleKW) {
    if (lower.includes(kw)) {
      intent.keywords.push(kw);
      console.log("[HEURISTIC] Keyword found:", kw);
    }
  }

  console.log("[HEURISTIC] ✅ Extraction complete");
  console.log("[HEURISTIC] Result:", JSON.stringify(intent));
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  return intent;
}

// LLM-powered intent extraction via Groq API (primary)
async function extractIntentGroq(text) {
  console.log("[GROQ] Starting Groq API call...");
  console.log("[GROQ] Query:", text);
  
  if (!process.env.GROQ_API_KEY) {
    console.log("[GROQ] ❌ No GROQ_API_KEY found in environment");
    throw new Error("No Groq API key");
  }
  
  const startTime = Date.now();
  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 256,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: 'Extract job search intent from the user query. Respond ONLY with valid JSON: {"keywords":[],"location":null,"skills":[],"category":null}. category must be one of: Backend, Frontend, Full Stack, DevOps, Data, Mobile, Sales, PM, Support, Management, Other, or null. skills should be specific technologies. keywords are general role/seniority words.'
          },
          { role: "user", content: text }
        ],
      }),
    });
    
    const data = await resp.json();
    const elapsed = Date.now() - startTime;
    
    if (data.error) {
      console.log("[GROQ] ❌ API Error:", data.error.message);
      throw new Error(data.error.message || "Groq API error");
    }
    
    const raw = data.choices?.[0]?.message?.content || "{}";
    const intent = JSON.parse(raw.replace(/```json|```/g, "").trim());
    
    console.log("[GROQ] ✅ Success in", elapsed + "ms");
    console.log("[GROQ] Extracted intent:", JSON.stringify(intent));
    
    return intent;
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.log("[GROQ] ❌ Failed after", elapsed + "ms:", err.message);
    throw err;
  }
}

// LLM intent extraction with Groq primary, heuristic fallback
async function extractIntentLLM(text) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[NLP] Starting intent extraction");
  console.log("[NLP] Query:", text);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  try {
    const intent = await extractIntentGroq(text);
    console.log("[NLP] ✅ LLM extraction successful (Groq)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return intent;
  } catch (groqErr) {
    console.log("[NLP] ⚠️  Groq failed, falling back to heuristic rules");
    console.log("[NLP] Error reason:", groqErr.message);
    throw groqErr; // Will be caught in semantic search endpoint for heuristic fallback
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CATEGORY SEARCH   →   GET /search/category/:cat
//    Dataset has real categories: Backend, Frontend, Data, DevOps, Mobile, etc.
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/search/category/:cat", async (req, res) => {
  try {
    const { page = 1, limit = 12, query } = req.query;
    const filter = { category: { $regex: new RegExp(req.params.cat, "i") } };
    if (query) filter.$text = { $search: query };

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Job.countDocuments(filter);
    const jobs  = await Job.find(filter, query ? { score: { $meta: "textScore" } } : {})
      .sort({ date_posted: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      jobs: jobs.map(normalizeJobForFrontend),
      total,
      page: +page,
      pages: Math.ceil(total / parseInt(limit)),
      category: req.params.cat,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SKILLS-ONLY SEARCH   →   GET /search/by-skills
//    Matches against the `keywords` array field.
//    matchPercent: what % of supplied skills must match (default 50)
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/search/by-skills", async (req, res) => {
  try {
    const { skills, matchPercent = 50, page = 1, limit = 12 } = req.query;
    if (!skills) return res.status(400).json({ error: "skills param required" });

    const skillArr = skills.split(",").map((s) => s.trim()).filter(Boolean);
    const minMatch = Math.max(1, Math.ceil(skillArr.length * (parseInt(matchPercent) / 100)));

    const pipeline = [
      {
        $addFields: {
          matchCount: {
            $size: {
              $filter: {
                input: "$keywords",
                as: "k",
                cond: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: skillArr,
                          as: "q",
                          cond: { $regexMatch: { input: "$$k", regex: "$$q", options: "i" } },
                        },
                      },
                    },
                    0,
                  ],
                },
              },
            },
          },
        },
      },
      { $match: { matchCount: { $gte: minMatch } } },
      { $sort:  { matchCount: -1, date_posted: -1 } },
      {
        $facet: {
          totalCount: [{ $count: "count" }],
          data: [
            { $skip:  (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) },
          ],
        },
      },
    ];

    const result = await Job.aggregate(pipeline);
    const total  = result[0]?.totalCount?.[0]?.count ?? 0;

    res.json({
      jobs:          (result[0]?.data ?? []).map(normalizeJobForFrontend),
      total,
      page:  +page,
      pages: Math.ceil(total / parseInt(limit)),
      queriedSkills: skillArr,
      matchPercent:  parseInt(matchPercent),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. SIMILAR JOBS   →   GET /search/similar/:id
//    Scores by: keyword overlap (×3) + same category (×2) + same location (×1)
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/search/similar/:id", async (req, res) => {
  try {
    const source = await Job.findById(req.params.id);
    if (!source) return res.status(404).json({ error: "Job not found" });

    const pipeline = [
      { $match: { _id: { $ne: source._id } } },
      {
        $addFields: {
          keywordOverlap: {
            $size: {
              $ifNull: [
                { $setIntersection: ["$keywords", source.keywords || []] },
                [],
              ],
            },
          },
          sameCategory: { $cond: [{ $eq: ["$category",      source.category] },      2, 0] },
          sameLoc:      { $cond: [{ $eq: ["$location_norm", source.location_norm] }, 1, 0] },
        },
      },
      {
        $addFields: {
          score: { $add: [{ $multiply: ["$keywordOverlap", 3] }, "$sameCategory", "$sameLoc"] },
        },
      },
      { $match: { score: { $gte: 1 } } },
      { $sort:  { score: -1 } },
      { $limit: parseInt(req.query.limit || 6) },
    ];

    const jobs = await Job.aggregate(pipeline);
    res.json({ jobs: jobs.map(normalizeJobForFrontend), sourceJob: source._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. BOOLEAN EXCLUDE   →   GET /search/exclude
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/search/exclude", async (req, res) => {
  try {
    const { query, excludeTerms, location, category, page = 1, limit = 12 } = req.query;
    const filter = {};
    if (query)    filter.$text        = { $search: query };
    if (location) filter.location_norm = { $regex: new RegExp(location, "i") };
    if (category) filter.category     = { $regex: new RegExp(category, "i") };

    if (excludeTerms) {
      const terms = excludeTerms.split(",").map((t) => t.trim());
      filter.$nor = terms.flatMap((t) => [
        { title:           { $regex: t, $options: "i" } },
        { job_description: { $regex: t, $options: "i" } },
      ]);
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Job.countDocuments(filter);
    const jobs  = await Job.find(filter, query ? { score: { $meta: "textScore" } } : {})
      .sort({ date_posted: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      jobs: jobs.map(normalizeJobForFrontend),
      total,
      page: +page,
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. AUTOCOMPLETE / SUGGESTIONS   →   GET /suggest
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/suggest", async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;
    if (!q || q.length < 2) return res.json({ titles: [], companies: [], skills: [] });

    const re = new RegExp(q, "i");
    const [titles, companies, skillDocs] = await Promise.all([
      Job.distinct("title",   { title:   re }),
      Job.distinct("company", { company: re }),
      Job.aggregate([
        { $unwind: "$keywords" },
        { $match:  { keywords: re } },
        { $group:  { _id: "$keywords" } },
        { $limit:  parseInt(limit) },
      ]),
    ]);

    res.json({
      titles:    titles.slice(0, parseInt(limit)),
      companies: companies.slice(0, parseInt(limit)),
      skills:    skillDocs.map((d) => d._id),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. SAVED SEARCHES
// ═══════════════════════════════════════════════════════════════════════════════
app.post("/saved-searches", async (req, res) => {
  try {
    const { userId, name, params } = req.body;
    if (!userId || !name || !params) return res.status(400).json({ error: "userId, name, params required" });
    const saved = await SavedSearch.create({ userId, name, params });
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/saved-searches/:userId", async (req, res) => {
  try {
    const searches = await SavedSearch.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(searches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/saved-searches/:id", async (req, res) => {
  try {
    await SavedSearch.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// META ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/meta/locations", async (_, res) => {
  try {
    const locs = await Job.distinct("location_norm");
    res.json(locs.filter(Boolean).sort());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/meta/companies", async (_, res) => {
  try { res.json((await Job.distinct("company")).filter(Boolean).sort()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/meta/categories", async (_, res) => {
  try { res.json((await Job.distinct("category")).filter(Boolean).sort()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/meta/skills", async (_, res) => {
  try {
    const docs = await Job.aggregate([
      { $unwind: "$keywords" },
      { $group:  { _id: "$keywords", count: { $sum: 1 } } },
      { $sort:   { count: -1 } },
      { $limit:  100 },
    ]);
    res.json(docs.map((d) => ({ skill: d._id, count: d.count })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/meta/stats", async (_, res) => {
  try {
    const [total, byCategory, skillsCount] = await Promise.all([
      Job.countDocuments(),
      Job.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Job.aggregate([{ $group: { _id: null, uniqueSkills: { $sum: { $size: "$keywords" } } } }]),
    ]);
    res.json({ total, byCategory, totalSkillsIndexed: skillsCount[0]?.uniqueSkills || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Single job
app.get("/jobs/:id", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(normalizeJobForFrontend(job));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀  Server running on http://localhost:${PORT}`));