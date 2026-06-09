const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();
const { ALL_SLOTS } = require("./seedData.js");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// DATABASE CONNECTION
// ==========================================

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ivzeldc.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

async function run() {
  try {
    await client.connect();
    db = client.db("ete_routine_db");
    await db.command({ ping: 1 });
    console.log("[DB] Connected to MongoDB successfully.");

    // Ensure indexes exist on startup
    await db.collection("users").createIndex({ "credentials.initials": 1 }, { unique: true });
    await db.collection("series_config").createIndex({ series: 1 }, { unique: true });
    await db.collection("routine_slots").createIndex({ series: 1, day: 1, semester: 1 });
    await db.collection("requests").createIndex({ status: 1 });
    console.log("[DB] Indexes verified.");
  } catch (err) {
    console.error("[DB] Connection failed:", err);
    process.exit(1);
  }
}
run();

// ==========================================
// MIDDLEWARE: DB Guard
// ==========================================

function requireDb(req, res, next) {
  if (!db) return res.status(503).json({ success: false, message: "Database not ready." });
  next();
}



app.get("/api/health", (req, res) => {
  const token = req.headers["x-cron-secret"];
  if (token !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  res.json({ success: true, status: "running", dbConnected: !!db, timestamp: new Date().toISOString() });
});

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

/**
 * POST /api/auth/student
 * Mathematical roll/registration validation — zero DB lookup.
 * Roll format: YY04XXX  (e.g. 2204047)
 *   YY  = series (19–25)
 *   XXX = roll suffix 001–061
 * Registration = 724 + parseInt(XXX)   → roll 001 → reg 725, roll 060 → reg 784
 * Batch: XXX <= 30 → "1st30", else "2nd30"
 */
app.post("/api/auth/student", (req, res) => {
  const { roll, registration } = req.body;

  if (!roll || !registration) {
    return res.status(400).json({ success: false, message: "Roll and Registration are required." });
  }

  // Pattern: exactly YY04XXX  (2 digits)(04)(3 digits)
  const rollRegex = /^([1-2][0-9])04(\d{3})$/;
  const match = roll.trim().match(rollRegex);

  if (!match) {
    return res.status(400).json({ success: false, message: "Invalid Roll format. Expected: YY04XXX (e.g. 2204047)." });
  }

  const series = parseInt(match[1], 10);
  const rollSuffix = parseInt(match[2], 10);

  if (rollSuffix < 1 || rollSuffix > 61) {
    return res.status(400).json({ success: false, message: "Roll suffix must be between 001 and 061." });
  }

  const expectedReg = 724 + rollSuffix;

  if (parseInt(registration, 10) !== expectedReg) {
    return res.status(401).json({ success: false, message: "Registration number does not match Roll." });
  }

  const batch = rollSuffix <= 30 ? "1st30" : "2nd30";

  return res.json({
    success: true,
    user: {
      role: "student",
      series,
      batch,
      roll: roll.trim(),
      displayName: `Roll: ${roll.trim()}`,
    },
  });
});

/**
 * POST /api/auth/staff
 * Teacher / HOD login. Lookup by initials in `users` collection.
 * NOTE: In production swap raw passwordHash comparison with bcrypt.compare()
 */
app.post("/api/auth/staff", requireDb, async (req, res) => {
  const { initials, password } = req.body;

  if (!initials || !password) {
    return res.status(400).json({
      success: false,
      message: "Initials and password are required.",
    });
  }

  try {
    const user = await db.collection("users").findOne({
      "credentials.initials": initials.trim().toUpperCase(),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid initials or password.",
      });
    }

    // FIXED LINE 👇
    if (user.credentials.password !== password) {
      return res.status(401).json({
        success: false,
        message: "Invalid initials or password.",
      });
    }

    return res.json({
      success: true,
      user: {
        role: user.role,
        initials: user.credentials.initials,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("[Auth/Staff]", error);
    return res.status(500).json({
      success: false,
      message: "Server error during authentication.",
    });
  }
});

// ==========================================
// 2. SERIES LIFECYCLE ROUTES (HOD Only)
// ==========================================

/**
 * GET /api/series
 * Returns all active series configs (used by frontend to build grid rows).
 */
app.get("/api/series", requireDb, async (req, res) => {
  try {
    const configs = await db
      .collection("series_config")
      .find({ isActive: true })
      .sort({ series: -1 }) // newest series first
      .toArray();

    return res.json({ success: true, data: configs });
  } catch (error) {
    console.error("[Series/GET]", error);
    return res.status(500).json({ success: false, message: "Failed to fetch series configurations." });
  }
});

/**
 * POST /api/series
 * HOD adds a new series.
 * Body: { series: number, currentSemester: 'odd'|'even', label: string }
 */
app.post("/api/series", requireDb, async (req, res) => {
  const { series, currentSemester, label } = req.body;

  if (!series || !currentSemester || !label) {
    return res.status(400).json({ success: false, message: "series, currentSemester, and label are required." });
  }

  if (!["odd", "even"].includes(currentSemester)) {
    return res.status(400).json({ success: false, message: "currentSemester must be 'odd' or 'even'." });
  }

  try {
    const existing = await db.collection("series_config").findOne({ series: parseInt(series, 10) });

    if (existing) {
      // Reactivate if it was soft-deleted
      if (!existing.isActive) {
        await db.collection("series_config").updateOne(
          { series: parseInt(series, 10) },
          { $set: { isActive: true, currentSemester, label, reactivatedAt: new Date().toISOString() } }
        );
        return res.json({ success: true, message: `Series ${series} reactivated.` });
      }
      return res.status(409).json({ success: false, message: `Series ${series} already exists and is active.` });
    }

    await db.collection("series_config").insertOne({
      series: parseInt(series, 10),
      isActive: true,
      currentSemester,
      label,
      createdAt: new Date().toISOString(),
    });

    return res.json({ success: true, message: `Series ${series} added successfully.` });
  } catch (error) {
    console.error("[Series/POST]", error);
    return res.status(500).json({ success: false, message: "Failed to add series." });
  }
});
/**
 * PATCH /api/series/:series/edit
 * HOD edits series metadata (like the label)
 */
app.patch("/api/series/:series/edit", requireDb, async (req, res) => {
  const series = parseInt(req.params.series, 10);
  const { label } = req.body;

  try {
    const result = await db.collection("series_config").updateOne(
      { series, isActive: true }, 
      { $set: { label, updatedAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) return res.status(404).json({ success: false, message: "Series not found." });
    return res.json({ success: true, message: `Series ${series} updated.` });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update series." });
  }
});


/**
 * PATCH /api/series/:series/semester
 * HOD updates the current semester for a series.
 * Body: { currentSemester: 'odd'|'even' }
 */
app.patch("/api/series/:series/semester", requireDb, async (req, res) => {
  const series = parseInt(req.params.series, 10);
  const { currentSemester } = req.body;

  if (!["odd", "even"].includes(currentSemester)) {
    return res.status(400).json({ success: false, message: "currentSemester must be 'odd' or 'even'." });
  }

  try {
    const result = await db
      .collection("series_config")
      .updateOne({ series, isActive: true }, { $set: { currentSemester, updatedAt: new Date().toISOString() } });

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: `Active series ${series} not found.` });
    }

    return res.json({ success: true, message: `Series ${series} semester updated to '${currentSemester}'.` });
  } catch (error) {
    console.error("[Series/PATCH Semester]", error);
    return res.status(500).json({ success: false, message: "Failed to update semester." });
  }
});

/**
 * DELETE /api/series/:series
 * HOD soft-deletes (graduates) a series.
 * Routine data is preserved; series is just hidden from the live view.
 */
app.delete("/api/series/:series", requireDb, async (req, res) => {
  const series = parseInt(req.params.series, 10);

  try {
    const result = await db
      .collection("series_config")
      .updateOne(
        { series, isActive: true },
        { $set: { isActive: false, graduatedAt: new Date().toISOString() } }
      );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: `Active series ${series} not found.` });
    }

    return res.json({ success: true, message: `Series ${series} graduated and removed from active routine.` });
  } catch (error) {
    console.error("[Series/DELETE]", error);
    return res.status(500).json({ success: false, message: "Failed to delete series." });
  }
});

// ==========================================
// 3. ROUTINE SLOT ROUTES
// ==========================================

/**
 * GET /api/routine/all/slots
 * Fetch ALL active series slots in a single call—powers the Master Routine grid.
 * Query: ?batch=all|1st30|2nd30
 */
app.get("/api/routine/all/slots", requireDb, async (req, res) => {
  const { batch } = req.query;

  try {
    // 1. Fetch all active series + their current semesters
    const activeSeries = await db
      .collection("series_config")
      .find({ isActive: true })
      .sort({ series: -1 })
      .toArray();

    if (activeSeries.length === 0) {
      return res.json({ success: true, data: {}, seriesConfigs: [] });
    }

    // 2. Build per-series queries in parallel
    const results = await Promise.all(
      activeSeries.map(async (cfg) => {
        let query = { series: cfg.series, semester: cfg.currentSemester };
        if (batch && batch !== "all") {
          query.$or = [{ batchScope: "all" }, { batchScope: batch }];
        }
        const slots = await db.collection("routine_slots").find(query).toArray();
        return { series: cfg.series, semester: cfg.currentSemester, slots };
      })
    );

    // 3. Key by series number for easy frontend lookup
    const data = {};
    results.forEach(({ series, semester, slots }) => {
      data[series] = { semester, slots };
    });

    return res.json({ success: true, data, seriesConfigs: activeSeries });
  } catch (error) {
    console.error("[Routine/All]", error);
    return res.status(500).json({ success: false, message: "Failed to fetch master routine." });
  }
});

/**
 * GET /api/routine/:series
 * Fetch all slots for a given series.
 * Query params:
 * ?batch=all|1st30|2nd30
 * ?semester=odd|even (optional - overrides the active HOD config for viewing past/future)
 */
app.get("/api/routine/:series", requireDb, async (req, res) => {
  const series = parseInt(req.params.series, 10);
  // 1. ADDED: Destructure 'semester' from the query parameters
  const { batch, semester: requestedSemester } = req.query;

  try {
    const config = await db.collection("series_config").findOne({ series, isActive: true });
    if (!config) {
      return res.status(404).json({ success: false, message: `Series ${series} not found or inactive.` });
    }

    // 2. CHANGED: Use the requested semester if the teacher toggled it, otherwise default to the active config
    const semester = requestedSemester || config.currentSemester;

    // Build batch filter
    let query = { series, semester };
    if (batch && batch !== "all") {
      query.$or = [{ batchScope: "all" }, { batchScope: batch }];
    }

    const slots = await db.collection("routine_slots").find(query).toArray();
    return res.json({ success: true, data: slots, semester });
  } catch (error) {
    console.error("[Routine/GET]", error);
    return res.status(500).json({ success: false, message: "Failed to fetch routine." });
  }
});

/**
 * POST /api/routine/slots
 * HOD manually inserts a new slot.
 * Body: full routine_slot document (minus _id)
 */
app.post("/api/routine/slots", requireDb, async (req, res) => {
  const { series, semester, day, startPeriod, periodSpan, type, courseCode, courseName, teachers, room, batchScope } =
    req.body;

  if (!series || !semester || !day || !startPeriod) {
    return res.status(400).json({ success: false, message: "series, semester, day, startPeriod are required." });
  }

  try {
    const slot = {
      series: parseInt(series, 10),
      semester,
      day,
      startPeriod: parseInt(startPeriod, 10),
      periodSpan: parseInt(periodSpan, 10) || 1,
      type: type || "class",
      courseCode: courseCode || "",
      courseName: courseName || "",
      teachers: teachers || [],
      room: room || "",
      batchScope: batchScope || "all",
      createdAt: new Date().toISOString(),
    };

    const result = await db.collection("routine_slots").insertOne(slot);
    return res.json({ success: true, message: "Slot created.", slotId: result.insertedId });
  } catch (error) {
    console.error("[Routine/POST Slot]", error);
    return res.status(500).json({ success: false, message: "Failed to create slot." });
  }
});

/**
 * PUT /api/routine/slots/:id
 * HOD directly edits a slot.
 */
app.put("/api/routine/slots/:id", requireDb, async (req, res) => {
  try {
    const { _id, ...updates } = req.body; // strip _id from body
    const result = await db
      .collection("routine_slots")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: { ...updates, updatedAt: new Date().toISOString() } });

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Slot not found." });
    }

    return res.json({ success: true, message: "Slot updated." });
  } catch (error) {
    console.error("[Routine/PUT Slot]", error);
    return res.status(500).json({ success: false, message: "Failed to update slot." });
  }
});

/**
 * DELETE /api/routine/slots/:id
 * HOD removes a slot.
 */
app.delete("/api/routine/slots/:id", requireDb, async (req, res) => {
  try {
    const result = await db
      .collection("routine_slots")
      .deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Slot not found." });
    }

    return res.json({ success: true, message: "Slot deleted." });
  } catch (error) {
    console.error("[Routine/DELETE Slot]", error);
    return res.status(500).json({ success: false, message: "Failed to delete slot." });
  }
});

// ==========================================
// 4. TEACHER REQUEST ROUTES
// ==========================================

/**
 * POST /api/requests
 * Teacher submits a slot_change or lab_booking request.
 */
app.post("/api/requests", requireDb, async (req, res) => {
  const { type, submittedBy, slotChange, labBooking } = req.body;

  if (!type || !submittedBy) {
    return res.status(400).json({ success: false, message: "type and submittedBy are required." });
  }

  if (!["slot_change", "lab_booking"].includes(type)) {
    return res.status(400).json({ success: false, message: "type must be 'slot_change' or 'lab_booking'." });
  }

  try {
    const newRequest = {
      type,
      status: "pending",
      submittedBy: submittedBy.toUpperCase(),
      createdAt: new Date().toISOString(),
      processedAt: null,
      slotChange: type === "slot_change" ? slotChange : null,
      labBooking: type === "lab_booking" ? labBooking : null,
    };

    const result = await db.collection("requests").insertOne(newRequest);
    return res.json({ success: true, message: "Request submitted to HOD.", requestId: result.insertedId });
  } catch (error) {
    console.error("[Requests/POST]", error);
    return res.status(500).json({ success: false, message: "Failed to submit request." });
  }
});

/**
 * GET /api/requests/pending
 * HOD fetches all pending requests.
 */
app.get("/api/requests/pending", requireDb, async (req, res) => {
  try {
    const requests = await db
      .collection("requests")
      .find({ status: "pending" })
      .sort({ createdAt: -1 })
      .toArray();

    return res.json({ success: true, data: requests });
  } catch (error) {
    console.error("[Requests/GET Pending]", error);
    return res.status(500).json({ success: false, message: "Failed to fetch pending requests." });
  }
});

/**
 * GET /api/requests/all
 * HOD fetches full request history.
 */
app.get("/api/requests/all", requireDb, async (req, res) => {
  try {
    const requests = await db
      .collection("requests")
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return res.json({ success: true, data: requests });
  } catch (error) {
    console.error("[Requests/GET All]", error);
    return res.status(500).json({ success: false, message: "Failed to fetch requests." });
  }
});

/**
 * POST /api/requests/:id/approve
 * HOD approves a request. Automatically executes the relevant MongoDB mutations.
 */
app.post("/api/requests/:id/approve", requireDb, async (req, res) => {
  const requestId = req.params.id;

  try {
    const request = await db.collection("requests").findOne({ _id: new ObjectId(requestId) });

    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found." });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ success: false, message: `Request is already '${request.status}'.` });
    }

    // ---- Execute the change ----
    if (request.type === "slot_change" && request.slotChange) {
      const sc = request.slotChange;
      await db.collection("routine_slots").updateOne(
        { _id: new ObjectId(sc.existingSlotId) },
        {
          $set: {
            day: sc.proposedDay,
            startPeriod: sc.proposedPeriodSpan[0],
            periodSpan: sc.proposedPeriodSpan.length,
            updatedAt: new Date().toISOString(),
            lastApprovedRequest: requestId,
          },
        }
      );
    } else if (request.type === "lab_booking" && request.labBooking) {
      const lb = request.labBooking;
      await db.collection("routine_slots").insertOne({
        series: lb.series,
        semester: lb.semester,
        day: lb.day,
        startPeriod: lb.startPeriod,
        periodSpan: lb.periodSpan || 3,
        type: "lab",
        courseCode: lb.courseCode || "",
        courseName: lb.courseName || "",
        teachers: lb.teachers || [request.submittedBy],
        room: lb.room || "",
        batchScope: lb.batchScope || "all",
        createdAt: new Date().toISOString(),
        sourceRequest: requestId,
      });
    }

    // ---- Mark approved ----
    await db.collection("requests").updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: "approved", processedAt: new Date().toISOString() } }
    );

    return res.json({ success: true, message: "Request approved. Routine updated automatically." });
  } catch (error) {
    console.error("[Requests/Approve]", error);
    return res.status(500).json({ success: false, message: "Failed to approve request." });
  }
});

/**
 * POST /api/requests/:id/reject
 * HOD rejects a request with an optional reason.
 */
app.post("/api/requests/:id/reject", requireDb, async (req, res) => {
  const { reason } = req.body;

  try {
    const result = await db.collection("requests").updateOne(
      { _id: new ObjectId(req.params.id), status: "pending" },
      {
        $set: {
          status: "rejected",
          rejectionReason: reason || "No reason provided.",
          processedAt: new Date().toISOString(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Pending request not found." });
    }

    return res.json({ success: true, message: "Request rejected." });
  } catch (error) {
    console.error("[Requests/Reject]", error);
    return res.status(500).json({ success: false, message: "Failed to reject request." });
  }
});

// ==========================================
// 5. UTILITY / SEED ROUTES
// ==========================================

/**
 * GET /api/health
 * Simple health check.
 */
app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "running", dbConnected: !!db, timestamp: new Date().toISOString() });
});

/**
 * POST /api/seed/user
 * Development-only: seed a staff user.
 * Remove or protect this route in production.
 */
app.post("/api/seed/user", requireDb, async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ success: false, message: "Seed route disabled in production." });
  }

  const { name, role, initials, password } = req.body;

  try {
    await db.collection("users").insertOne({
      name,
      role: role || "teacher",
      credentials: { initials: initials.toUpperCase(), passwordHash: password },
    });
    return res.json({ success: true, message: `User ${initials} seeded.` });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Initials already exist." });
    }
    return res.status(500).json({ success: false, message: "Seed failed.", error: err.message });
  }
});


/**
 * POST /api/seed/series
 * Development-only: seed initial series configs.
 */
app.post("/api/seed/series", requireDb, async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ success: false, message: "Seed route disabled in production." });
  }

  const defaultSeries = [
    { series: 20, isActive: true, currentSemester: "even",  label: "20 Series (4th Year)" },
    { series: 21, isActive: true, currentSemester: "odd", label: "21 Series (4th Year)" },
    { series: 22, isActive: true, currentSemester: "odd", label: "22 Series (3rd Year)" },
    { series: 23, isActive: true, currentSemester: "even",  label: "23 Series (2nd Year)" },
    { series: 24, isActive: true, currentSemester: "odd", label: "24 Series (2nd year)" },
  ];

  try {
    for (const s of defaultSeries) {
      await db.collection("series_config").updateOne(
        { series: s.series },
        { $setOnInsert: { ...s, createdAt: new Date().toISOString() } },
        { upsert: true }
      );
    }
    return res.json({ success: true, message: "Default series seeded (20–24)." });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Seed failed.", error: err.message });
  }
});
/**
 * POST /api/seed/slots
 * Development-only: bulk insert ALL_SLOTS into routine_slots collection.
 */
app.post("/api/seed/slots", requireDb, async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ success: false, message: "Seed route disabled in production." });
  }

  if (!ALL_SLOTS || ALL_SLOTS.length === 0) {
    return res.status(400).json({ success: false, message: "ALL_SLOTS array is empty or undefined." });
  }

  try {
    // 1. Wipe existing slots to prevent duplicates upon multiple runs
    await db.collection("routine_slots").deleteMany({});

    // 2. Strip string _ids so MongoDB generates proper ObjectIds
    const cleanSlots = ALL_SLOTS.map((slot) => {
      const { _id, ...rest } = slot;
      return {
        ...rest,
        createdAt: new Date().toISOString(),
      };
    });

    // 3. Bulk insert
    const result = await db.collection("routine_slots").insertMany(cleanSlots);

    return res.json({ 
      success: true, 
      message: `Successfully seeded ${result.insertedCount} slots into the database.` 
    });
  } catch (err) {
    console.error("[Seed/Slots]", err);
    return res.status(500).json({ success: false, message: "Slot seeding failed.", error: err.message });
  }
});

// ==========================================
// START SERVER
// ==========================================

app.listen(port, () => {
  console.log(`[Server] ETE Routine API running on port ${port}`);
});