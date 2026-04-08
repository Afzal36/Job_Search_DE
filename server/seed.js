// seed.js — Populate MongoDB with 120 realistic job listings
// Run: node seed.js
require("dotenv").config();
const mongoose = require("mongoose");

mongoose.connect(process.env.DB_URL).then(() => console.log("Connected to MongoDB")).catch(console.error);

const JobSchema = new mongoose.Schema({}, { strict: false });
const Job = mongoose.model("jobs", JobSchema);

const TITLES = [
  "Senior Frontend Engineer", "Backend Developer", "Full Stack Engineer",
  "DevOps Engineer", "Data Scientist", "ML Engineer", "Product Manager",
  "UX Designer", "Android Developer", "iOS Developer", "Cloud Architect",
  "Security Engineer", "QA Engineer", "Python Developer", "React Developer",
  "Node.js Developer", "Go Developer", "Data Analyst", "Site Reliability Engineer",
  "Kubernetes Specialist", "AI Research Engineer", "Blockchain Developer",
  "Embedded Systems Engineer", "Technical Lead", "Engineering Manager",
];

const COMPANIES = [
  "Google", "Amazon", "Microsoft", "Flipkart", "Razorpay", "Zepto", "CRED",
  "PhonePe", "Swiggy", "Zomato", "Infosys", "Wipro", "TCS", "HCL", "Paytm",
  "Byju's", "Ola", "Meesho", "Freshworks", "Zoho", "Browserstack", "Postman",
];

const LOCATIONS = [
  "Bangalore", "Hyderabad", "Mumbai", "Delhi", "Pune",
  "Chennai", "Noida", "Gurgaon", "Remote", "Kolkata",
];

const TYPES = ["Full-time", "Remote", "Contract"];

const SKILLS_POOL = [
  ["React", "TypeScript", "Redux", "GraphQL", "Next.js", "TailwindCSS"],
  ["Node.js", "Express", "MongoDB", "Redis", "Docker", "REST APIs"],
  ["Python", "FastAPI", "PostgreSQL", "Kafka", "AWS", "Pandas"],
  ["Kubernetes", "Docker", "Terraform", "CI/CD", "GCP", "Prometheus"],
  ["Python", "TensorFlow", "Scikit-learn", "Pandas", "SQL", "Spark"],
  ["Go", "gRPC", "Kubernetes", "Prometheus", "Grafana", "Microservices"],
  ["AWS", "Lambda", "S3", "CloudFormation", "Python", "CDK"],
  ["React", "Node.js", "PostgreSQL", "Docker", "AWS", "GraphQL"],
  ["Flutter", "Dart", "Firebase", "REST", "SQLite", "Android"],
  ["Swift", "Xcode", "CoreData", "ARKit", "Combine", "SwiftUI"],
  ["Java", "Spring Boot", "MySQL", "Kafka", "Docker", "Microservices"],
  ["Angular", "TypeScript", "RxJS", "NgRx", "Jasmine", "SCSS"],
  ["Kotlin", "Jetpack Compose", "Coroutines", "Retrofit", "Room", "Hilt"],
  ["Rust", "WebAssembly", "LLVM", "Tokio", "Serde", "Cargo"],
  ["Vue.js", "Nuxt.js", "Vuex", "Cypress", "Vite", "Pinia"],
];

const DESCRIPTIONS = [
  "Join our world-class engineering team to build scalable products used by millions. You will work on cutting-edge challenges with a talented, collaborative team in a fast-paced startup environment.",
  "We are looking for a passionate engineer to help us scale our infrastructure and deliver features at high velocity. Ownership and real impact are at the core of this role.",
  "Help us design and develop robust distributed systems. You will collaborate closely with product and design teams to create exceptional user experiences at scale.",
  "Drive technical excellence by architecting modern cloud-native solutions. Strong engineering culture with competitive compensation and equity.",
  "Solve complex machine-learning problems at scale. Work with petabytes of data and state-of-the-art models to power our core recommendation and personalisation engine.",
  "Build and maintain high-reliability payment infrastructure serving 50M+ transactions daily. Deep focus on security, observability, and zero-downtime deployments.",
  "Shape the mobile experience for our 10M+ user base. Own features end-to-end from conception through deployment and iteration using user feedback.",
  "Lead a team of talented engineers to deliver mission-critical features. You will define technical roadmaps, mentor junior engineers, and partner with product.",
];

const EXP = ["0-1", "1-3", "2-4", "3-5", "5-8", "7-12"];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function seed() {
  await Job.deleteMany({});
  console.log("Cleared existing jobs");

  const jobs = [];
  for (let i = 0; i < 120; i++) {
    const salary  = randomInt(8, 55);
    const daysAgo = randomInt(0, 90);
    jobs.push({
      title:       TITLES[i % TITLES.length],
      company:     randomItem(COMPANIES),
      location:    randomItem(LOCATIONS),
      type:        TYPES[i % 3],
      description: randomItem(DESCRIPTIONS),
      skills:      SKILLS_POOL[i % SKILLS_POOL.length],
      experience:  randomItem(EXP) + " years",
      salary:      `${salary} LPA`,
      date_posted: new Date(Date.now() - daysAgo * 86_400_000),
    });
  }

  await Job.insertMany(jobs);
  console.log(`✅  Inserted ${jobs.length} job listings`);
  mongoose.disconnect();
}

seed().catch(err => { console.error(err); mongoose.disconnect(); });