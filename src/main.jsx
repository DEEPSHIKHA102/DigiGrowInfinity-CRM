import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  Facebook,
  FileSpreadsheet,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Tags,
  Trash2,
  UserCog,
  UserMinus,
  Users,
  WalletCards
} from "lucide-react";
import "./styles.css";

const roleConfig = {
  super_admin: {
    label: "Super Admin",
    subtitle: "Platform owner",
    allowed: ["super", "dashboard", "users", "numbers", "contacts", "inbox", "broadcasts", "templates", "chatbot", "analytics", "billing", "settings", "audit"]
  },
  admin: {
    label: "Admin",
    subtitle: "Agency / Business owner",
    allowed: ["dashboard", "users", "numbers", "contacts", "inbox", "broadcasts", "templates", "chatbot", "analytics", "billing", "settings", "audit"]
  },
  agent: {
    label: "Sub-User / Agent",
    subtitle: "Assigned inbox and contacts",
    allowed: ["dashboard", "contacts", "inbox", "templates", "analytics"]
  }
};

const nav = [
  ["super", "Super Admin", ShieldCheck],
  ["dashboard", "Dashboard", LayoutDashboard],
  ["users", "Sub-Users", UserCog],
  ["numbers", "WhatsApp Numbers", Phone],
  ["contacts", "Contacts", Users],
  ["inbox", "Shared Inbox", Inbox],
  ["broadcasts", "Broadcasts", Megaphone],
  ["templates", "Templates", MessageSquareText],
  ["chatbot", "Chatbot", Bot],
  ["analytics", "Analytics", BarChart3],
  ["billing", "Billing", CreditCard],
  ["settings", "Settings", Settings],
  ["audit", "Audit Log", Activity]
];

const permissions = ["View Contacts", "Send Messages", "Manage Chatbots", "View Analytics", "Manage Broadcasts", "Manage Templates"];

const seedContacts = [
  { id: "DGI-1001", name: "Ananya Sharma", phone: "+91 98765 41001", email: "ananya@urbannest.in", tags: "Meta, Hot", group: "Bangalore", status: "Active", createdTime: "10 Jun 2026, 09:48 AM" },
  { id: "DGI-1002", name: "Karan Mehta", phone: "+91 98765 41002", email: "karan@fitprostudio.com", tags: "WhatsApp", group: "Fitness", status: "Pending", createdTime: "10 Jun 2026, 10:52 AM" },
  { id: "DGI-1003", name: "Sofia Khan", phone: "+91 98765 41003", email: "sofia@bloomclinic.in", tags: "Clinic, Demo", group: "Healthcare", status: "Active", createdTime: "09 Jun 2026, 04:44 PM" }
];

const seedUsers = [
  { id: "USR-001", name: "Riya Sen", email: "riya@digigrow.com", role: "Agent", permissions: ["View Contacts", "Send Messages"], assignedNumber: "+91 98765 43210", assignedGroup: "Bangalore", status: "Active" },
  { id: "USR-002", name: "Aman Rao", email: "aman@digigrow.com", role: "Manager", permissions: ["View Contacts", "Send Messages", "View Analytics"], assignedNumber: "+91 98765 43211", assignedGroup: "Fitness", status: "Active" }
];

const seedMessages = [
  { id: 1, side: "left", text: "Hi, I came from Meta lead form. Need pricing." },
  { id: 2, side: "right", text: "Sure, please share your city and monthly budget." }
];

const API_URL = `${window.location.protocol}//${window.location.hostname}:5000/api`;

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("dgi_token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }

  return response.json();
}

async function ensureDemoSession() {
  if (localStorage.getItem("dgi_token")) return;
  const session = await apiRequest("/demo/session", { method: "POST", body: JSON.stringify({}) });
  localStorage.setItem("dgi_token", session.token);
}

async function refreshDemoSession() {
  localStorage.removeItem("dgi_token");
  await ensureDemoSession();
}

function leadToContact(lead) {
  return {
    id: lead._id || lead.id,
    name: lead.name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    tags: lead.source || "manual",
    group: lead.company || "",
    status: labelize(lead.stage || "new"),
    createdTime: lead.createdAt ? new Date(lead.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : nowText()
  };
}

function App() {
  const [role, setRole] = useState("admin");
  const [active, setActive] = useState("dashboard");
  const [toast, setToast] = useState("");
  const [contacts, setContacts] = useState(seedContacts);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [users, setUsers] = useState(seedUsers);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [messages, setMessages] = useState(seedMessages);
  const [numbers, setNumbers] = useState([
    { id: "NUM-001", phone: "+91 98765 43210", wabaId: "WABA-8291", status: "Active", assignedTo: "Riya Sen" },
    { id: "NUM-002", phone: "+91 98765 43211", wabaId: "WABA-8292", status: "Pending", assignedTo: "Aman Rao" }
  ]);
  const [broadcasts, setBroadcasts] = useState([
    { id: "BRD-001", name: "June Lead Follow-up", template: "pricing_followup", group: "Bangalore", status: "Scheduled", sent: 0, delivered: 0, read: 0, failed: 0 }
  ]);
  const [templates, setTemplates] = useState([
    { id: "TPL-001", name: "pricing_followup", category: "Marketing", language: "en", body: "Hi {{1}}, here is the pricing plan.", status: "Approved" }
  ]);
  const [audit, setAudit] = useState([{ id: 1, event: "Admin logged in", actor: "Admin", time: nowText() }]);

  const currentRole = roleConfig[role];
  const visibleNav = nav.filter(([id]) => currentRole.allowed.includes(id));

  useEffect(() => {
    let cancelled = false;

    async function loadLeads() {
      try {
        await ensureDemoSession();
        let leads;
        try {
          leads = await apiRequest("/leads");
        } catch (error) {
          if (!error.message.toLowerCase().includes("token")) throw error;
          await refreshDemoSession();
          leads = await apiRequest("/leads");
        }
        if (!cancelled) {
          setContacts(leads.length ? leads.map(leadToContact) : seedContacts);
        }
      } catch (error) {
        notify(`Mongo sync unavailable: ${error.message}`);
      }
    }

    loadLeads();
    return () => {
      cancelled = true;
    };
  }, []);

  function notify(text) {
    setToast(text);
    setAudit((items) => [{ id: Date.now(), event: text, actor: currentRole.label, time: nowText() }, ...items]);
    window.setTimeout(() => setToast(""), 1800);
  }

  function changeRole(nextRole) {
    setRole(nextRole);
    if (!roleConfig[nextRole].allowed.includes(active)) {
      setActive("dashboard");
    }
  }

  function handleQuickAction(action) {
    if (action === "broadcasts") {
      setActive("broadcasts");
      notify("Open Broadcasts");
      return;
    }

    if (action === "contacts") {
      setActive("contacts");
      setContactFormOpen(true);
      notify("Add lead form opened");
      return;
    }

    if (action === "users") {
      setActive("users");
      setUserFormOpen(true);
      notify("Add user form opened");
      return;
    }

    if (action === "numbers") {
      setActive("numbers");
      notify("Open WhatsApp Numbers");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-900 text-white">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold">digigrowinfinity_CRM</h1>
              <p className="text-sm text-slate-500">WhatsApp SaaS Platform</p>
            </div>
          </div>
        </div>
        <nav className="space-y-1 overflow-y-auto p-4">
          {visibleNav.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-bold ${
                active === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Single login URL</p>
              <p className="font-semibold">app.digigrowinfinity.com/login</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden h-10 w-80 items-center gap-2 rounded-lg border border-slate-200 px-3 md:flex">
                <Search size={17} className="text-slate-400" />
                <input className="w-full outline-none" placeholder="Search contacts, chats, users" />
              </div>
              <select value={role} onChange={(event) => changeRole(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="agent">Agent</option>
              </select>
            </div>
          </div>
        </header>

        {toast && <div className="fixed right-5 top-20 z-30 rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white">{toast}</div>}

        <div className="mx-auto max-w-7xl p-5">
          <MobileTabs visibleNav={visibleNav} active={active} setActive={setActive} />
          <RoleNotice role={currentRole} />
          {active === "super" && <SuperAdmin users={users} numbers={numbers} notify={notify} />}
          {active === "dashboard" && <Dashboard contacts={contacts} users={users} messages={messages} broadcasts={broadcasts} onQuickAction={handleQuickAction} />}
          {active === "users" && <SubUsers users={users} setUsers={setUsers} notify={notify} showForm={userFormOpen} setShowForm={setUserFormOpen} />}
          {active === "numbers" && <Numbers numbers={numbers} setNumbers={setNumbers} users={users} notify={notify} />}
          {active === "contacts" && <Contacts contacts={contacts} setContacts={setContacts} notify={notify} showForm={contactFormOpen} setShowForm={setContactFormOpen} />}
          {active === "inbox" && <InboxView messages={messages} setMessages={setMessages} users={users} notify={notify} />}
          {active === "broadcasts" && <Broadcasts broadcasts={broadcasts} setBroadcasts={setBroadcasts} templates={templates} notify={notify} />}
          {active === "templates" && <Templates templates={templates} setTemplates={setTemplates} notify={notify} />}
          {active === "chatbot" && <Chatbot notify={notify} />}
          {active === "analytics" && <Analytics contacts={contacts} users={users} broadcasts={broadcasts} />}
          {active === "billing" && <Billing notify={notify} />}
          {active === "settings" && <SettingsView notify={notify} />}
          {active === "audit" && <AuditLog audit={audit} />}
        </div>
      </main>
    </div>
  );
}

function RoleNotice({ role }) {
  return (
    <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
      <p className="font-bold">{role.label}</p>
      <p className="text-sm text-blue-800">{role.subtitle}. Data is designed around tenant/org isolation with role-based module access.</p>
    </div>
  );
}

function MobileTabs({ visibleNav, active, setActive }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:hidden">
      {visibleNav.slice(0, 8).map(([id, label, Icon]) => (
        <button key={id} onClick={() => setActive(id)} className={`flex h-11 items-center justify-center gap-2 rounded-lg border text-xs font-bold ${active === id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}>
          <Icon size={16} />
          {label}
        </button>
      ))}
    </div>
  );
}

function Dashboard({ contacts, users, messages, broadcasts, onQuickAction }) {
  const quickActions = [
    { label: "New Broadcast", action: "broadcasts" },
    { label: "New Contact", action: "contacts" },
    { label: "Add User", action: "users" },
    { label: "Connect WhatsApp Number", action: "numbers" }
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Total contacts" value={contacts.length} />
        <Metric label="Sub-users" value={users.length} />
        <Metric label="Inbox messages" value={messages.length} />
        <Metric label="Broadcasts" value={broadcasts.length} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Panel title="Latest Leads">
          <ContactTable contacts={contacts.slice(0, 5)} />
        </Panel>
        <Panel title="Quick Actions">
          <div className="grid gap-3">
            {quickActions.map((item) => (
              <button
                key={item.label}
                onClick={() => onQuickAction(item.action)}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 text-left font-bold hover:border-slate-900 hover:bg-white"
              >
                {item.label}
                <Plus size={17} />
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SuperAdmin({ users, numbers, notify }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Admins" value="3" />
        <Metric label="Sub-users" value={users.length} />
        <Metric label="Active numbers" value={numbers.filter((item) => item.status === "Active").length} />
        <Metric label="Revenue" value="Rs 1.8L" />
      </div>
      <Panel title="Platform Controls">
        <div className="grid gap-4 md:grid-cols-3">
          <ActionCard title="Admin Management" text="Create, suspend, delete admins." action="Create admin" notify={notify} />
          <ActionCard title="Subscription Management" text="Assign plans and payment status." action="Assign plan" notify={notify} />
          <ActionCard title="Impersonation" text="Login as any admin for support." action="Login as admin" notify={notify} />
        </div>
      </Panel>
    </div>
  );
}

function SubUsers({ users, setUsers, notify, showForm, setShowForm }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "Agent", assignedNumber: "", assignedGroup: "", permissions: ["View Contacts", "Send Messages"] });

  function togglePermission(permission) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission) ? current.permissions.filter((item) => item !== permission) : [...current.permissions, permission]
    }));
  }

  function saveUser(event) {
    event.preventDefault();
    setUsers((items) => [{ ...form, id: `USR-${Date.now().toString().slice(-4)}`, status: "Active" }, ...items]);
    setShowForm(false);
    setForm({ name: "", email: "", password: "", role: "Agent", assignedNumber: "", assignedGroup: "", permissions: ["View Contacts", "Send Messages"] });
    notify("Sub-user created");
  }

  return (
    <Panel title="Sub-User / Team Management">
      <TopAction label="Create Sub-User" onClick={() => setShowForm((value) => !value)} />
      {showForm && (
        <form onSubmit={saveUser} className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
            <Field label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} required />
            <Field label="Password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} required />
            <SelectField label="Role" value={form.role} onChange={(value) => setForm({ ...form, role: value })} options={["Agent", "Manager", "Viewer"]} />
            <Field label="Assigned WhatsApp Number" value={form.assignedNumber} onChange={(value) => setForm({ ...form, assignedNumber: value })} />
            <Field label="Assigned Contact Group" value={form.assignedGroup} onChange={(value) => setForm({ ...form, assignedGroup: value })} />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {permissions.map((permission) => (
              <label key={permission} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm font-bold">
                <input type="checkbox" checked={form.permissions.includes(permission)} onChange={() => togglePermission(permission)} />
                {permission}
              </label>
            ))}
          </div>
          <button className="mt-4 h-10 rounded-lg bg-slate-900 px-5 text-sm font-bold text-white">Save user</button>
        </form>
      )}
      <div className="grid gap-3">
        {users.map((user) => (
          <div key={user.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email} · {user.role}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{user.status}</span>
            </div>
            <p className="mt-3 text-sm text-slate-600">Permissions: {user.permissions.join(", ")}</p>
            <p className="mt-1 text-sm text-slate-500">Number: {user.assignedNumber || "-"} · Group: {user.assignedGroup || "-"}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Numbers({ numbers, setNumbers, users, notify }) {
  const [form, setForm] = useState({ phone: "", wabaId: "", status: "Pending", assignedTo: users[0]?.name || "" });

  function addNumber(event) {
    event.preventDefault();
    setNumbers((items) => [{ ...form, id: `NUM-${Date.now().toString().slice(-4)}` }, ...items]);
    setForm({ phone: "", wabaId: "", status: "Pending", assignedTo: users[0]?.name || "" });
    notify("WhatsApp number connected");
  }

  return (
    <Panel title="WhatsApp Number Management">
      <form onSubmit={addNumber} className="mb-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
        <Field label="Phone number" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} required />
        <Field label="WABA ID" value={form.wabaId} onChange={(value) => setForm({ ...form, wabaId: value })} required />
        <SelectField label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={["Active", "Pending", "Disconnected"]} />
        <SelectField label="Assign Agent" value={form.assignedTo} onChange={(value) => setForm({ ...form, assignedTo: value })} options={users.map((user) => user.name)} />
        <button className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-bold text-white md:col-span-4">Connect number</button>
      </form>
      <DataGrid rows={numbers} columns={["id", "phone", "wabaId", "status", "assignedTo"]} />
    </Panel>
  );
}

function Contacts({ contacts, setContacts, notify, showForm, setShowForm }) {
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState(makeEmptyContact());
  const [saving, setSaving] = useState(false);

  async function saveContact(event) {
    event.preventDefault();
    setSaving(true);

    try {
      await ensureDemoSession();
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        company: form.group,
        source: "manual",
        stage: form.status || "new",
        rawPayload: { localId: form.id, tags: form.tags, createdTime: form.createdTime }
      };
      let lead;

      try {
        lead = await apiRequest("/leads", { method: "POST", body: JSON.stringify(payload) });
      } catch (error) {
        if (!error.message.toLowerCase().includes("token")) throw error;
        await refreshDemoSession();
        lead = await apiRequest("/leads", { method: "POST", body: JSON.stringify(payload) });
      }

      setContacts((items) => [leadToContact(lead), ...items]);
      setForm(makeEmptyContact());
      setShowForm(false);
      notify("Lead saved in MongoDB");
    } catch (error) {
      notify(`Lead not saved: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Leads / CRM">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => setShowForm((value) => !value)} className="flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white">
          <Plus size={17} /> Add Lead
        </button>
        <div className="flex items-center gap-2">
          <span className="mr-2 text-sm font-semibold text-slate-500">{selected.length} selected</span>
          <IconButton icon={UserMinus} title="Remove assignment" />
          <IconButton icon={Trash2} title="Delete" danger />
          <IconButton icon={Download} title="Download CSV" />
          <IconButton icon={FileSpreadsheet} title="Import/Export sheet" />
          <IconButton icon={Tags} title="Manage tags" />
        </div>
      </div>
      {showForm && (
        <form onSubmit={saveContact} className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="ID" value={form.id} onChange={(value) => setForm({ ...form, id: value })} required />
            <Field label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
            <Field label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} required />
            <Field label="Phone no" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} required />
            <Field label="Tags" value={form.tags} onChange={(value) => setForm({ ...form, tags: value })} />
            <Field label="Group" value={form.group} onChange={(value) => setForm({ ...form, group: value })} />
            <Field label="Created time" value={form.createdTime} onChange={(value) => setForm({ ...form, createdTime: value })} />
            <SelectField label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={["Active", "Pending", "Inactive", "Converted"]} />
          </div>
          <button disabled={saving} className="mt-4 h-10 rounded-lg bg-slate-900 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">
            {saving ? "Saving..." : "Save lead"}
          </button>
        </form>
      )}
      <ContactTable contacts={contacts} selected={selected} setSelected={setSelected} />
    </Panel>
  );
}

function InboxView({ messages, setMessages, users, notify }) {
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("Open");
  const [assigned, setAssigned] = useState(users[0]?.name || "");

  function sendMessage(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    setMessages((items) => [...items, { id: Date.now(), side: "right", text: draft.trim() }]);
    setDraft("");
    notify("WhatsApp message sent");
  }

  return (
    <Panel title="Shared Inbox">
      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          {["Urban Nest", "FitPro Studio", "Bloom Clinic"].map((name, index) => (
            <div key={name} className={`rounded-lg border p-4 ${index === 0 ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"}`}>
              <p className="font-bold">{name}</p>
              <p className="mt-1 text-sm text-slate-500">WhatsApp · assigned to {assigned || "Unassigned"}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <SelectField label="Assign agent" value={assigned} onChange={setAssigned} options={users.map((user) => user.name)} />
            <SelectField label="Conversation status" value={status} onChange={setStatus} options={["Open", "Pending", "Resolved"]} />
            <Field label="Internal note" value={note} onChange={setNote} />
          </div>
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.side === "right" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-md rounded-lg px-4 py-3 text-sm ${message.side === "right" ? "bg-slate-900 text-white" : "bg-white"}`}>{message.text}</div>
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage} className="mt-5 flex gap-2">
            <input value={draft} onChange={(event) => setDraft(event.target.value)} className="h-11 flex-1 rounded-lg border border-slate-200 px-3 outline-none" placeholder="Type message or quick reply" />
            <button className="grid h-11 w-11 place-items-center rounded-lg bg-slate-900 text-white"><Send size={18} /></button>
          </form>
        </div>
      </div>
    </Panel>
  );
}

function Broadcasts({ broadcasts, setBroadcasts, templates, notify }) {
  const [form, setForm] = useState({ name: "", template: templates[0]?.name || "", group: "Bangalore", status: "Scheduled", scheduledAt: "" });

  function saveBroadcast(event) {
    event.preventDefault();
    setBroadcasts((items) => [{ ...form, id: `BRD-${Date.now().toString().slice(-4)}`, sent: 0, delivered: 0, read: 0, failed: 0 }, ...items]);
    setForm({ name: "", template: templates[0]?.name || "", group: "Bangalore", status: "Scheduled", scheduledAt: "" });
    notify("Broadcast scheduled");
  }

  return (
    <Panel title="Bulk Broadcast">
      <form onSubmit={saveBroadcast} className="mb-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
        <Field label="Broadcast name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
        <SelectField label="Template" value={form.template} onChange={(value) => setForm({ ...form, template: value })} options={templates.map((item) => item.name)} />
        <Field label="Contact group" value={form.group} onChange={(value) => setForm({ ...form, group: value })} />
        <Field label="Schedule" type="datetime-local" value={form.scheduledAt} onChange={(value) => setForm({ ...form, scheduledAt: value })} />
        <button className="h-10 self-end rounded-lg bg-slate-900 px-5 text-sm font-bold text-white">Schedule</button>
      </form>
      <DataGrid rows={broadcasts} columns={["id", "name", "template", "group", "status", "sent", "delivered", "read", "failed"]} />
    </Panel>
  );
}

function Templates({ templates, setTemplates, notify }) {
  const [form, setForm] = useState({ name: "", category: "Marketing", language: "en", body: "", status: "Pending" });

  function saveTemplate(event) {
    event.preventDefault();
    setTemplates((items) => [{ ...form, id: `TPL-${Date.now().toString().slice(-4)}` }, ...items]);
    setForm({ name: "", category: "Marketing", language: "en", body: "", status: "Pending" });
    notify("Template submitted for Meta approval");
  }

  return (
    <Panel title="Template Manager">
      <form onSubmit={saveTemplate} className="mb-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
        <Field label="Template name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
        <SelectField label="Category" value={form.category} onChange={(value) => setForm({ ...form, category: value })} options={["Marketing", "Utility", "Authentication"]} />
        <Field label="Language" value={form.language} onChange={(value) => setForm({ ...form, language: value })} />
        <SelectField label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={["Pending", "Approved", "Rejected"]} />
        <label className="text-sm font-bold text-slate-600 md:col-span-4">
          Body with variables
          <textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 outline-none" placeholder="Hi {{1}}, your order {{2}} is ready." />
        </label>
        <button className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-bold text-white md:col-span-4">Submit template</button>
      </form>
      <DataGrid rows={templates} columns={["id", "name", "category", "language", "status", "body"]} />
    </Panel>
  );
}

function Chatbot({ notify }) {
  const steps = ["Trigger: First message", "Ask question", "Send text/image", "Condition if/else", "Transfer to agent", "Webhook call"];
  return (
    <Panel title="Chatbot Builder">
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <Bot className="text-slate-900" size={22} />
            <p className="mt-3 font-bold">{step}</p>
            <p className="mt-1 text-sm text-slate-500">Flow step {index + 1}</p>
          </div>
        ))}
      </div>
      <button onClick={() => notify("Chatbot activated")} className="mt-5 rounded-lg bg-slate-900 px-5 py-3 text-sm font-bold text-white">Activate chatbot</button>
    </Panel>
  );
}

function Analytics({ contacts, users, broadcasts }) {
  return (
    <Panel title="Analytics">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Sent" value="8,420" />
        <Metric label="Delivered" value="7,980" />
        <Metric label="Read" value="5,124" />
        <Metric label="Failed" value="91" />
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <MiniChart title="Chatbot completion" values={[70, 55, 85, 62]} />
        <MiniChart title="Agent response" values={users.map((_, index) => 60 + index * 12)} />
        <MiniChart title="Broadcast reads" values={broadcasts.map((item) => Math.max(20, item.read + 45))} />
      </div>
      <p className="mt-4 text-sm text-slate-500">Contacts tracked: {contacts.length}. Date range filter and deeper reports are UI-ready for backend data.</p>
    </Panel>
  );
}

function Billing({ notify }) {
  return (
    <Panel title="Billing & Subscription">
      <div className="grid gap-4 md:grid-cols-3">
        <ActionCard title="Current Plan" text="Agency Pro: 15 users, 5 WhatsApp numbers." action="Upgrade plan" notify={notify} />
        <ActionCard title="Message Pricing" text="Track Meta conversation-based billing." action="View usage" notify={notify} />
        <ActionCard title="Payment Gateway" text="Razorpay/Stripe integration placeholder." action="Connect gateway" notify={notify} />
      </div>
    </Panel>
  );
}

function SettingsView({ notify }) {
  return (
    <Panel title="Settings">
      <div className="grid gap-4 md:grid-cols-2">
        <ActionCard title="Profile & Notifications" text="Admin profile, alerts, session timeout." action="Save profile" notify={notify} />
        <ActionCard title="API Keys & Webhooks" text="Client API keys and webhook URL settings." action="Generate key" notify={notify} />
        <ActionCard title="White Label" text="Logo, brand color and custom client domain." action="Save brand" notify={notify} />
        <ActionCard title="Security" text="2FA, IP whitelist, failed login lock." action="Update security" notify={notify} />
      </div>
    </Panel>
  );
}

function AuditLog({ audit }) {
  return (
    <Panel title="Audit Log">
      <DataGrid rows={audit} columns={["id", "event", "actor", "time"]} />
    </Panel>
  );
}

function ContactTable({ contacts, selected = [], setSelected }) {
  function toggle(id) {
    if (!setSelected) return;
    setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[1000px] bg-white text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="w-12 px-4 py-3"></th>
            {["ID", "Name", "Phone no", "Email", "Tags", "Group", "Created time", "Status"].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {contacts.map((contact) => (
            <tr key={contact.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">{setSelected && <input type="checkbox" checked={selected.includes(contact.id)} onChange={() => toggle(contact.id)} />}</td>
              <td className="px-4 py-3 font-bold">{contact.id}</td>
              <td className="px-4 py-3 font-bold">{contact.name}</td>
              <td className="px-4 py-3">{contact.phone}</td>
              <td className="px-4 py-3">{contact.email}</td>
              <td className="px-4 py-3">{contact.tags}</td>
              <td className="px-4 py-3">{contact.group}</td>
              <td className="px-4 py-3">{contact.createdTime}</td>
              <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{contact.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DataGrid({ rows, columns }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[800px] bg-white text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>{columns.map((column) => <th key={column} className="px-4 py-3">{labelize(column)}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              {columns.map((column) => <td key={column} className="px-4 py-3">{Array.isArray(row[column]) ? row[column].join(", ") : row[column]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionCard({ title, text, action, notify }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <CheckCircle2 className="text-emerald-600" size={22} />
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
      <button onClick={() => notify(action)} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">{action}</button>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function MiniChart({ title, values }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="font-bold">{title}</h3>
      <div className="mt-5 flex h-32 items-end gap-3">
        {values.map((value, index) => <div key={`${title}-${index}`} className="flex-1 rounded-t bg-slate-900" style={{ height: `${Math.min(100, value)}%` }} />)}
      </div>
    </div>
  );
}

function TopAction({ label, onClick }) {
  return (
    <button onClick={onClick} className="mb-4 flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white">
      <Plus size={17} /> {label}
    </button>
  );
}

function Field({ label, value, onChange, type = "text", required }) {
  return (
    <label className="text-sm font-bold text-slate-600">
      {label}
      <input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none" />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="text-sm font-bold text-slate-600">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-bold">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function IconButton({ icon: Icon, title, danger }) {
  return (
    <button title={title} className={`grid h-10 w-10 place-items-center rounded-lg border ${danger ? "border-rose-200 text-rose-600" : "border-slate-200 text-slate-600"}`}>
      <Icon size={18} />
    </button>
  );
}

function makeEmptyContact() {
  return { id: `DGI-${Date.now().toString().slice(-5)}`, name: "", phone: "", email: "", tags: "", group: "", status: "Active", createdTime: nowText() };
}

function nowText() {
  return new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function labelize(value) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

createRoot(document.getElementById("root")).render(<App />);
