// server.js — Job Portal Search Engine Backend
// MongoDB Full-Text Search + Indexing · Extended Search Edition
// Run: node server.js
require("dotenv").config(); 
const express   = require("express");
const mongoose  = require("mongoose");
const cors      = require("cors");

const app = express();
app.use(cors({
  origin: "https://job-search-de.vercel.app"
}));
app.use(express.json());

// ─── DB Connection ─────────────────────────────────────────────────────────────
mongoose.connect(process.env.DB_URL).then(() => console.log("✅  MongoDB connected"))
  .catch(err => console.error("❌  MongoDB error:", err));

// ─── Schemas ───────────────────────────────────────────────────────────────────

// Job document (flexible — works with Kaggle CSV imports too)
const JobSchema = new mongoose.Schema({}, { strict: false });
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
// Creates a compound text index across all searchable fields.
// MongoDB assigns relevance scores automatically.
Job.collection.createIndex(
  { title: "text", description: "text", skills: "text", company: "text", location: "text" },
  { name: "job_text_index", default_language: "english" }
).catch(() => {}); // index may already exist

// ═══════════════════════════════════════════════════════════════════════════════
// 1. STANDARD FULL-TEXT + FILTER SEARCH   →   GET /search
//    Supports: keyword, location, company, type, salary range,
//              experience, skills (ALL), sortBy, pagination
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/search", async (req, res) => {
  try {
    const {
      query, location, company, type,
      minSalary, maxSalary, experience, skills,
      sortBy = "date_posted", order = "desc",
      page = 1, limit = 12,
    } = req.query;

    const filter = {};
    if (query)      filter.$text       = { $search: query };
    if (location)   filter.location    = { $regex: new RegExp(location, "i") };
    if (company)    filter.company     = { $regex: new RegExp(company,  "i") };
    if (type)       filter.type        = { $regex: new RegExp(type,     "i") };
    if (experience) filter.experience  = { $regex: new RegExp(experience, "i") };
    if (skills) {
      const arr = skills.split(",").map(s => s.trim());
      filter.skills = { $all: arr.map(s => new RegExp(s, "i")) };
    }

    // Salary filter requires aggregation pipeline to parse numeric values
    if (minSalary || maxSalary) {
      const pipeline = buildSalaryPipeline(filter, minSalary, maxSalary, sortBy, order, page, limit);
      const result   = await Job.aggregate(pipeline);
      const total    = result[0]?.totalCount?.[0]?.count ?? 0;
      return res.json({
        jobs:  result[0]?.data ?? [],
        total, page: +page,
        pages: Math.ceil(total / limit),
      });
    }

    // Regular find + sort
    const sort = {};
    if (query && sortBy === "relevance") sort.score = { $meta: "textScore" };
    else sort[sortBy === "date_posted" ? "date_posted" : sortBy] = order === "asc" ? 1 : -1;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Job.countDocuments(filter);
    const jobs  = await Job.find(filter, query ? { score: { $meta: "textScore" } } : {})
      .sort(sort).skip(skip).limit(parseInt(limit));

    res.json({ jobs, total, page: +page, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BOOLEAN SEARCH   →   GET /search/boolean
//    must   = comma-separated terms that MUST appear (AND logic)
//    should = comma-separated terms where at least one must appear (OR logic)
//    not    = comma-separated terms that must NOT appear (exclusion)
//    Example: /search/boolean?must=React,Node&should=AWS,GCP&not=PHP
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/search/boolean", async (req, res) => {
  try {
    const { must, should, not, page = 1, limit = 12 } = req.query;

    const andClauses = [];

    if (must) {
      must.split(",").map(t => t.trim()).forEach(term => {
        andClauses.push({
          $or: [
            { title:       { $regex: term, $options: "i" } },
            { description: { $regex: term, $options: "i" } },
            { skills:      { $regex: term, $options: "i" } },
          ],
        });
      });
    }

    if (should) {
      const orTerms = should.split(",").map(t => t.trim());
      andClauses.push({
        $or: orTerms.flatMap(term => [
          { title:       { $regex: term, $options: "i" } },
          { description: { $regex: term, $options: "i" } },
          { skills:      { $regex: term, $options: "i" } },
        ]),
      });
    }

    if (not) {
      not.split(",").map(t => t.trim()).forEach(term => {
        andClauses.push({
          $nor: [
            { title:       { $regex: term, $options: "i" } },
            { description: { $regex: term, $options: "i" } },
            { skills:      { $regex: term, $options: "i" } },
          ],
        });
      });
    }

    const filter = andClauses.length ? { $and: andClauses } : {};
    const skip   = (parseInt(page) - 1) * parseInt(limit);
    const total  = await Job.countDocuments(filter);
    const jobs   = await Job.find(filter)
      .sort({ date_posted: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ jobs, total, page: +page, pages: Math.ceil(total / parseInt(limit)), mode: "boolean" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SEMANTIC / AI NATURAL-LANGUAGE SEARCH   →   POST /search/semantic
//    Body: { naturalQuery: "I want a backend role in Bangalore with 15+ LPA" }
//    Heuristic NLP extracts intent (location, type, salary, skills, keywords).
//    Swap extractIntent() with an LLM call (e.g. Anthropic API) in production.
// ═══════════════════════════════════════════════════════════════════════════════
app.post("/search/semantic", async (req, res) => {
  try {
    const { naturalQuery, page = 1, limit = 12 } = req.body;
    if (!naturalQuery) return res.status(400).json({ error: "naturalQuery required" });

    const intent = extractIntent(naturalQuery);
    const filter = {};

    if (intent.keywords.length) filter.$text = { $search: intent.keywords.join(" ") };
    if (intent.location)        filter.location = { $regex: new RegExp(intent.location, "i") };
    if (intent.type)            filter.type     = { $regex: new RegExp(intent.type, "i") };
    if (intent.skills.length)   filter.skills   = { $all: intent.skills.map(s => new RegExp(s, "i")) };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (intent.minSalary || intent.maxSalary) {
      const pipeline = buildSalaryPipeline(filter, intent.minSalary, intent.maxSalary, "salary", "desc", page, limit);
      const result   = await Job.aggregate(pipeline);
      const total    = result[0]?.totalCount?.[0]?.count ?? 0;
      return res.json({
        jobs:  result[0]?.data ?? [],
        total, page: +page,
        pages: Math.ceil(total / limit),
        parsedIntent: intent,
      });
    }

    const total = await Job.countDocuments(filter);
    const jobs  = await Job.find(filter, intent.keywords.length ? { score: { $meta: "textScore" } } : {})
      .sort(intent.keywords.length ? { score: { $meta: "textScore" } } : { date_posted: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ jobs, total, page: +page, pages: Math.ceil(total / parseInt(limit)), parsedIntent: intent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Heuristic NLP intent extractor — replace with LLM in production
function extractIntent(text) {
  const lower = text.toLowerCase();
  const intent = { keywords: [], location: null, skills: [], type: null, minSalary: null, maxSalary: null };

  // Location detection
  const cities = ["bangalore", "bengaluru", "hyderabad", "mumbai", "delhi", "pune", "chennai", "kolkata", "noida", "gurgaon", "remote"];
  for (const city of cities) {
    if (lower.includes(city)) { intent.location = city; break; }
  }

  // Job type detection
  if (lower.includes("remote"))                                    intent.type = "Remote";
  else if (lower.includes("contract") || lower.includes("freelance")) intent.type = "Contract";
  else if (lower.includes("full-time") || lower.includes("full time")) intent.type = "Full-time";

  // Salary extraction: "15+ LPA", "20-30 LPA", "above 10"
  const salaryMatch = lower.match(/(\d+)\s*(?:\+|plus|above|more|lpa)?.*?(?:(\d+)\s*lpa)?/);
  if (salaryMatch && lower.match(/\d+.*lpa/)) {
    const rawMatch = lower.match(/(\d+)\s*\+\s*lpa/);
    if (rawMatch) intent.minSalary = parseInt(rawMatch[1]);
  }

  // Known skill keywords
  const knownSkills = [
    "react", "node", "python", "java", "golang", "go", "aws", "docker",
    "kubernetes", "typescript", "angular", "vue", "sql", "mongodb", "redis",
    "flutter", "kotlin", "swift", "ml", "ai", "pytorch", "tensorflow", "spark",
  ];
  for (const skill of knownSkills) {
    if (lower.includes(skill)) intent.skills.push(skill);
  }

  // Role/domain keywords (used for text search)
  const roleKeywords = [
    "backend", "frontend", "fullstack", "full stack", "devops", "data",
    "engineer", "developer", "manager", "lead", "senior", "junior",
    "intern", "analyst", "designer", "architect", "scientist",
  ];
  for (const kw of roleKeywords) {
    if (lower.includes(kw)) intent.keywords.push(kw);
  }

  return intent;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. DATE-RANGE SEARCH   →   GET /search/recent
//    Query params: days (7 | 14 | 30 | 90)
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/search/recent", async (req, res) => {
  try {
    const { days = 7, query, location, type, page = 1, limit = 12 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 86_400_000);

    const filter = { date_posted: { $gte: since } };
    if (query)    filter.$text    = { $search: query };
    if (location) filter.location = { $regex: new RegExp(location, "i") };
    if (type)     filter.type     = { $regex: new RegExp(type, "i") };

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Job.countDocuments(filter);
    const jobs  = await Job.find(filter, query ? { score: { $meta: "textScore" } } : {})
      .sort({ date_posted: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ jobs, total, page: +page, pages: Math.ceil(total / parseInt(limit)), since });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SIMILAR JOBS   →   GET /search/similar/:id
//    Scores jobs by: skills overlap (×3) + same type (×1) + same location (×1)
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/search/similar/:id", async (req, res) => {
  try {
    const source = await Job.findById(req.params.id);
    if (!source) return res.status(404).json({ error: "Job not found" });

    const { limit = 6 } = req.query;

    const pipeline = [
      { $match: { _id: { $ne: source._id } } },
      {
        $addFields: {
          skillOverlap: {
            $size: {
              $ifNull: [
                { $setIntersection: ["$skills", source.skills || []] },
                [],
              ],
            },
          },
          sameType:     { $cond: [{ $eq: ["$type",     source.type] },     1, 0] },
          sameLocation: { $cond: [{ $eq: ["$location", source.location] }, 1, 0] },
        },
      },
      {
        $addFields: {
          similarityScore: {
            $add: [{ $multiply: ["$skillOverlap", 3] }, "$sameType", "$sameLocation"],
          },
        },
      },
      { $match: { similarityScore: { $gte: 1 } } },
      { $sort:  { similarityScore: -1 } },
      { $limit: parseInt(limit) },
    ];

    const jobs = await Job.aggregate(pipeline);
    res.json({ jobs, sourceJob: source._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. MULTI-LOCATION SEARCH   →   GET /search/multi-location
//    Query params: locations=Bangalore,Mumbai,Pune (comma-separated)
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/search/multi-location", async (req, res) => {
  try {
    const { locations, query, type, page = 1, limit = 12 } = req.query;
    if (!locations) return res.status(400).json({ error: "locations param required" });

    const locArr = locations.split(",").map(l => l.trim());
    const filter = { location: { $in: locArr.map(l => new RegExp(l, "i")) } };
    if (query) filter.$text = { $search: query };
    if (type)  filter.type  = { $regex: new RegExp(type, "i") };

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Job.countDocuments(filter);
    const jobs  = await Job.find(filter)
      .sort({ date_posted: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ jobs, total, page: +page, pages: Math.ceil(total / parseInt(limit)), locations: locArr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. EXCLUDE-KEYWORDS SEARCH   →   GET /search/exclude
//    Query params: query (what to find), excludeTerms (comma-sep, what to omit)
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/search/exclude", async (req, res) => {
  try {
    const { query, excludeTerms, location, type, page = 1, limit = 12 } = req.query;

    const filter = {};
    if (query)    filter.$text    = { $search: query };
    if (location) filter.location = { $regex: new RegExp(location, "i") };
    if (type)     filter.type     = { $regex: new RegExp(type, "i") };

    if (excludeTerms) {
      const terms = excludeTerms.split(",").map(t => t.trim());
      filter.$nor = terms.flatMap(t => [
        { title:       { $regex: t, $options: "i" } },
        { description: { $regex: t, $options: "i" } },
      ]);
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Job.countDocuments(filter);
    const jobs  = await Job.find(filter, query ? { score: { $meta: "textScore" } } : {})
      .sort({ date_posted: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ jobs, total, page: +page, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. SKILLS-ONLY SEARCH   →   GET /search/by-skills
//    Returns jobs where the candidate matches at least matchPercent% of skills
//    Query params: skills (comma-sep), matchPercent (0-100, default 50)
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/search/by-skills", async (req, res) => {
  try {
    const { skills, matchPercent = 50, page = 1, limit = 12 } = req.query;
    if (!skills) return res.status(400).json({ error: "skills param required" });

    const skillArr = skills.split(",").map(s => s.trim());
    const minMatch = Math.ceil(skillArr.length * (parseInt(matchPercent) / 100));

    const pipeline = [
      {
        $addFields: {
          matchCount: {
            $size: {
              $filter: {
                input: "$skills",
                as:    "s",
                cond: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: skillArr,
                          as:    "q",
                          cond: { $regexMatch: { input: "$$s", regex: "$$q", options: "i" } },
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
      { $sort:  { matchCount: -1 } },
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
      jobs:          result[0]?.data ?? [],
      total,         page: +page,
      pages:         Math.ceil(total / parseInt(limit)),
      queriedSkills: skillArr,
      matchPercent:  parseInt(matchPercent),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. SAVED SEARCHES   →   POST / GET / DELETE  /saved-searches
// ═══════════════════════════════════════════════════════════════════════════════
app.post("/saved-searches", async (req, res) => {
  try {
    const { userId, name, params } = req.body;
    if (!userId || !name || !params)
      return res.status(400).json({ error: "userId, name, params required" });
    const saved = await SavedSearch.create({ userId, name, params });
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/saved-searches/:userId", async (req, res) => {
  try {
    const searches = await SavedSearch
      .find({ userId: req.params.userId })
      .sort({ createdAt: -1 });
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
// 10. AUTOCOMPLETE / SUGGESTIONS   →   GET /suggest
//     Returns matching titles, companies, and skills for typeahead
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
        { $unwind: "$skills" },
        { $match:  { skills: re } },
        { $group:  { _id: "$skills" } },
        { $limit:  parseInt(limit) },
      ]),
    ]);

    res.json({
      titles:    titles.slice(0, parseInt(limit)),
      companies: companies.slice(0, parseInt(limit)),
      skills:    skillDocs.map(d => d._id).slice(0, parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// META ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/meta/locations", async (_, res) => {
  try { res.json((await Job.distinct("location")).sort()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/meta/companies", async (_, res) => {
  try { res.json((await Job.distinct("company")).sort()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/meta/skills", async (_, res) => {
  try {
    const docs = await Job.aggregate([
      { $unwind: "$skills" },
      { $group:  { _id: "$skills", count: { $sum: 1 } } },
      { $sort:   { count: -1 } },
      { $limit:  50 },
    ]);
    res.json(docs.map(d => d._id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single job by ID
app.get("/jobs/:id", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Salary Pipeline Helper ────────────────────────────────────────────────────
// Parses salary strings like "18 LPA" into numbers for range filtering
function buildSalaryPipeline(filter, minSalary, maxSalary, sortBy, order, page, limit) {
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const pipeline = [
    { $match: filter },
    {
      $addFields: {
        salaryNum: {
          $toDouble: { $arrayElemAt: [{ $split: ["$salary", " "] }, 0] },
        },
      },
    },
  ];

  if (minSalary) pipeline.push({ $match: { salaryNum: { $gte: +minSalary } } });
  if (maxSalary) pipeline.push({ $match: { salaryNum: { $lte: +maxSalary } } });

  const sortField = sortBy === "salary" ? "salaryNum" : "date_posted";
  pipeline.push({ $sort: { [sortField]: order === "asc" ? 1 : -1 } });
  pipeline.push({
    $facet: {
      totalCount: [{ $count: "count" }],
      data:       [{ $skip: skip }, { $limit: parseInt(limit) }],
    },
  });

  return pipeline;
}

// ─── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀  Server running on http://localhost:${PORT}`));