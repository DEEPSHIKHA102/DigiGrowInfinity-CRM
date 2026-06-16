import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://127.0.0.1:5173" 
  })
);
app.use(express.json({ limit: "2mb" }));

const userSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["super_admin", "admin", "agent"], default: "agent" },
    permissions: [{ type: String }]
  },
  { timestamps: true }
);

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    plan: { type: String, default: "Agency Pro" },
    metaPageId: String,
    whatsappPhoneNumberId: String,
    status: { type: String, enum: ["active", "paused"], default: "active" }
  },
  { timestamps: true }
);

const leadSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true },
    phone: String,
    email: String,
    company: String,
    source: { type: String, enum: ["meta", "whatsapp", "website", "manual"], default: "manual" },
    stage: { type: String, default: "new" },
    value: { type: Number, default: 0 },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign" },
    rawPayload: Object
  },
  { timestamps: true }
);

const campaignSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true, required: true },
    name: { type: String, required: true },
    channel: { type: String, enum: ["meta", "whatsapp", "email", "mixed"], default: "meta" },
    status: { type: String, enum: ["draft", "live", "scheduled", "paused"], default: "draft" },
    budget: { type: Number, default: 0 },
    leadsCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const conversationSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true, required: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    channel: { type: String, enum: ["whatsapp", "instagram", "facebook", "website"], default: "whatsapp" },
    status: { type: String, enum: ["open", "pending", "closed"], default: "open" },
    messages: [
      {
        direction: { type: String, enum: ["inbound", "outbound"], required: true },
        text: String,
        providerMessageId: String,
        sentAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

const whatsappNumberSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true, required: true },
    phoneNumber: { type: String, required: true },
    wabaId: String,
    status: { type: String, enum: ["active", "pending", "disconnected"], default: "pending" },
    assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

const contactSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    tags: [String],
    group: String,
    customFields: Object,
    notes: [{ body: String, createdBy: String, createdAt: { type: Date, default: Date.now } }]
  },
  { timestamps: true }
);

const templateSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true, required: true },
    name: { type: String, required: true },
    metaTemplateId: String,
    category: String,
    language: { type: String, default: "en" },
    body: String,
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" }
  },
  { timestamps: true }
);

const broadcastSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true, required: true },
    name: { type: String, required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
    group: String,
    status: { type: String, enum: ["draft", "scheduled", "sending", "completed", "failed"], default: "draft" },
    scheduledAt: Date,
    sentCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    readCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const auditLogSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    entity: String,
    metadata: Object
  },
  { timestamps: true }
);

const Organization = mongoose.model("Organization", organizationSchema);
const User = mongoose.model("User", userSchema);
const Lead = mongoose.model("Lead", leadSchema);
const Campaign = mongoose.model("Campaign", campaignSchema);
const Conversation = mongoose.model("Conversation", conversationSchema);
const WhatsappNumber = mongoose.model("WhatsappNumber", whatsappNumberSchema);
const Contact = mongoose.model("Contact", contactSchema);
const Template = mongoose.model("Template", templateSchema);
const Broadcast = mongoose.model("Broadcast", broadcastSchema);
const AuditLog = mongoose.model("AuditLog", auditLogSchema);

const demoStore = {
  contacts: [],
  messages: [],
  auditLogs: []
};

async function connectDatabase() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/digigrowinfinity_crm";
  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${uri}`);
}

function createToken(user) {
  return jwt.sign(
    {
      id: user._id,
      orgId: user.orgId,
      role: user.role,
      permissions: user.permissions
    },
    jwtSecret,
    { expiresIn: "7d" }
  );
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing auth token" });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid auth token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Feature hidden for this role" });
    }

    return next();
  };
}

function tenantFilter(req) {
  if (req.user.role === "super_admin" && req.query.orgId) {
    return { orgId: req.query.orgId };
  }

  return { orgId: req.user.orgId };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "digigrowinfinity_CRM",
    database: mongoose.connection.readyState === 1 ? "connected" : "offline-demo-mode"
  });
});

app.post("/api/demo/messages", (req, res) => {
  const message = { id: Date.now(), ...req.body, createdAt: new Date().toISOString() };
  demoStore.messages.push(message);
  res.status(201).json(message);
});

app.post("/api/auth/register", async (req, res) => {
  const { organizationName, name, email, password } = req.body;

  if (!organizationName || !name || !email || !password) {
    return res.status(400).json({ message: "organizationName, name, email and password are required" });
  }

  const org = await Organization.create({ name: organizationName });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    orgId: org._id,
    name,
    email,
    passwordHash,
    role: "admin",
    permissions: ["dashboard", "inbox", "leads", "campaigns", "whatsapp", "meta", "chatbot", "analytics", "team"]
  });

  res.status(201).json({
    token: createToken(user),
    user: { id: user._id, name: user.name, email: user.email, role: user.role, orgId: user.orgId }
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  res.json({
    token: createToken(user),
    user: { id: user._id, name: user.name, email: user.email, role: user.role, orgId: user.orgId }
  });
});

app.get("/api/leads", requireAuth, async (req, res) => {
  const filter = tenantFilter(req);

  if (req.user.role === "agent") {
    filter.ownerId = req.user.id;
  }

  const leads = await Lead.find(filter).sort({ createdAt: -1 }).limit(100);
  res.json(leads);
});

app.post("/api/leads", requireAuth, async (req, res) => {
  const lead = await Lead.create({
    ...req.body,
    orgId: req.user.orgId,
    ownerId: req.body.ownerId || req.user.id
  });

  res.status(201).json(lead);
});

app.get("/api/campaigns", requireAuth, requireRole("admin", "super_admin"), async (req, res) => {
  const campaigns = await Campaign.find(tenantFilter(req)).sort({ createdAt: -1 });
  res.json(campaigns);
});

app.post("/api/campaigns", requireAuth, requireRole("admin", "super_admin"), async (req, res) => {
  const campaign = await Campaign.create({ ...req.body, orgId: req.user.orgId });
  res.status(201).json(campaign);
});

app.get("/api/contacts", requireAuth, async (req, res) => {
  const contacts = await Contact.find(tenantFilter(req)).sort({ createdAt: -1 }).limit(200);
  res.json(contacts);
});

app.post("/api/contacts", requireAuth, async (req, res) => {
  const contact = await Contact.create({ ...req.body, orgId: req.user.orgId });
  res.status(201).json(contact);
});

app.get("/api/whatsapp-numbers", requireAuth, requireRole("admin", "super_admin"), async (req, res) => {
  const numbers = await WhatsappNumber.find(tenantFilter(req)).sort({ createdAt: -1 });
  res.json(numbers);
});

app.post("/api/whatsapp-numbers", requireAuth, requireRole("admin", "super_admin"), async (req, res) => {
  const number = await WhatsappNumber.create({ ...req.body, orgId: req.user.orgId });
  res.status(201).json(number);
});

app.get("/api/templates", requireAuth, async (req, res) => {
  const templates = await Template.find(tenantFilter(req)).sort({ createdAt: -1 });
  res.json(templates);
});

app.post("/api/templates", requireAuth, requireRole("admin", "super_admin"), async (req, res) => {
  const template = await Template.create({ ...req.body, orgId: req.user.orgId });
  res.status(201).json(template);
});

app.get("/api/broadcasts", requireAuth, requireRole("admin", "super_admin"), async (req, res) => {
  const broadcasts = await Broadcast.find(tenantFilter(req)).sort({ createdAt: -1 });
  res.json(broadcasts);
});

app.post("/api/broadcasts", requireAuth, requireRole("admin", "super_admin"), async (req, res) => {
  const broadcast = await Broadcast.create({ ...req.body, orgId: req.user.orgId });
  res.status(201).json(broadcast);
});

app.get("/api/audit-logs", requireAuth, requireRole("admin", "super_admin"), async (req, res) => {
  const logs = await AuditLog.find(tenantFilter(req)).sort({ createdAt: -1 }).limit(200);
  res.json(logs);
});

app.get("/api/conversations", requireAuth, async (req, res) => {
  const filter = tenantFilter(req);

  if (req.user.role === "agent") {
    filter.assignedTo = req.user.id;
  }

  const conversations = await Conversation.find(filter)
    .populate("leadId", "name phone company")
    .sort({ updatedAt: -1 })
    .limit(50);

  res.json(conversations);
});

app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
  const conversation = await Conversation.findOne({ _id: req.params.id, ...tenantFilter(req) });

  if (!conversation) {
    return res.status(404).json({ message: "Conversation not found" });
  }

  conversation.messages.push({
    direction: "outbound",
    text: req.body.text,
    sentAt: new Date()
  });
  await conversation.save();

  res.status(201).json(conversation);
});

app.post("/api/webhooks/meta-leads", async (req, res) => {
  const { orgId, name, phone, email, company, campaignId } = req.body;

  if (!orgId || !name) {
    return res.status(400).json({ message: "orgId and name are required for demo webhook ingestion" });
  }

  const lead = await Lead.create({
    orgId,
    name,
    phone,
    email,
    company,
    campaignId,
    source: "meta",
    stage: "new",
    rawPayload: req.body
  });

  res.status(201).json({ received: true, leadId: lead._id });
});

app.post("/api/webhooks/whatsapp", async (req, res) => {
  const { orgId, leadId, text, providerMessageId } = req.body;

  if (!orgId || !text) {
    return res.status(400).json({ message: "orgId and text are required for demo webhook ingestion" });
  }

  const conversation = await Conversation.findOneAndUpdate(
    { orgId, leadId, status: { $ne: "closed" } },
    {
      $setOnInsert: { orgId, leadId, channel: "whatsapp" },
      $push: {
        messages: {
          direction: "inbound",
          text,
          providerMessageId,
          sentAt: new Date()
        }
      }
    },
    { upsert: true, new: true }
  );

  res.status(201).json({ received: true, conversationId: conversation._id });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Server error", detail: err.message });
});

connectDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`API running on http://127.0.0.1:${port}`);
    });
  })
  .catch((error) => {
    console.warn("MongoDB connection failed. Starting API in offline demo mode:", error.message);
    app.listen(port, () => {
      console.log(`API running on http://127.0.0.1:${port}`);
    });
  });
