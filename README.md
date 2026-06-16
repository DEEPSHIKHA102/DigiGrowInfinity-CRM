# digigrowinfinity_CRM

A Zoho-inspired CRM starter for agencies that manage Meta leads, WhatsApp conversations, campaigns, teams, analytics, and role-based access.

## Stack

- React + Vite + Tailwind CSS
- Node.js + Express.js
- MongoDB with Mongoose, ready for MongoDB Compass

## Run locally

```bash
npm install
copy .env.example .env
npm run dev
```

Open `http://127.0.0.1:5173`.

## Demo login roles

The frontend includes a role switcher so you can preview:

- Super Admin: platform owner
- Admin: agency/business owner
- Agent: sub-user/team member

The backend models include `orgId` for multi-tenant data isolation.
