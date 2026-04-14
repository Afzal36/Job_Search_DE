require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const mongoose = require("mongoose");

const CSV_FILE = path.resolve(__dirname, "jobs_data.csv");

// ===============================
// 🔹 MongoDB Connection
// ===============================
mongoose.connect(process.env.DB_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// ===============================
// 🔹 Schema
// ===============================
const JobSchema = new mongoose.Schema({
  company: String,
  category: String,
  post_link: String,
  job_description: String,
  location: String,
  date_posted: String,
  keywords: {
    type: [String],
    default: []
  }
}, { strict: false });

const Job = mongoose.model("jobs", JobSchema);

// ===============================
// 🔥 MAIN IMPORT
// ===============================
async function main() {
  const jobs = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on("data", row => {
        jobs.push({
          company: row.company || "",
          category: row.category || "Other",
          post_link: row.post_link || "",
          job_description: row.job_description || "",
          location: row.location || "",
          date_posted: row.date_posted || "",
          keywords: row.keywords
            ? row.keywords.split(",").map(k => k.trim())
            : []
        });
      })
      .on("end", resolve)
      .on("error", reject);
  });

  console.log(`📋 Parsed ${jobs.length} rows`);

  // Optional: clear old data
  await Job.deleteMany({});
  console.log("🗑️ Deleted old jobs");

  // Insert new dataset
  await Job.insertMany(jobs);
  console.log(`🎉 Inserted ${jobs.length} jobs successfully`);

  mongoose.connection.close();
}

main().catch(console.error);