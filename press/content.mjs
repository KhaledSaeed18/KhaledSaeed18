// What the README says. Identity, stack and principles are the site's own
// (khaledsaeed.tech: lib/site.ts and lib/content/profile.ts), copied here so
// the press runs without the site; README-only copy sits beside them with a
// pointer to where the site sets the same idea. House rules: sentence case,
// no em dashes, no emoji.

export const identity = {
  name: "Khaled Saeed",
  username: "KhaledSaeed18",
  role: "Full-stack engineer",
  location: "Lebanon",
  url: "https://khaledsaeed.tech",
  site: "khaledsaeed.tech",
  email: "contact@khaledsaeed.tech",
  booking: "https://cal.com/khaledsaeed",
  vcard: "https://khaledsaeed.tech/khaled-saeed.vcf",
  // components/home/hero.tsx
  headline: ["Khaled Saeed", "builds software that", "explains itself."],
  // .github/assets/readme-header.png
  focus: "interfaces / backends / developer tools",
  // lib/site.ts profileUpdatedAt: the datasheet's revision, the same on the site and here
  revised: "2026-10-28",
  // the GitHub bio, corrected in proof in the README
  bio: "I tell computers what to do and sometimes they listen!",
}

// components/home/hero.tsx and lib/content/profile.ts, set for the README
export const about = {
  title: "I design and build products end to end.",
  paragraphs: [
    "Interfaces people enjoy using, backends that hold up in production, and the tooling in between. Some of it ships with a team, some of it stays private, and some of it I give away. All of it gets the same standard: clear behaviour, honest errors, and nothing left for the next person to guess.",
    "TypeScript is my common language across web, backend, mobile and desktop. When a tool belongs on my Mac, I write it in Swift; on Linux, in Rust. I am completing an M.S. in Computer Engineering at the Lebanese International University, and going deeper into AI and machine learning.",
  ],
}

// lib/content/profile.ts: stack, in pin order
export const stack = [
  { layer: "Interface", items: ["React", "Next.js", "TanStack", "Tailwind CSS", "shadcn/ui", "Vite", "Redux", "Zustand", "Jotai", "React Hook Form", "Motion"] },
  { layer: "Services", items: ["Node.js", "NestJS", "Express", "Hono", "FastAPI", "Bun", "Django", "GraphQL", "Apollo", "WebSockets", "BullMQ", "Zod", "Pydantic", "OpenAPI", "JWT", "Clerk", "Resend"] },
  { layer: "Native", items: ["Swift", "SwiftUI", "Rust", "React Native", "Electron", "Expo", "Flutter", "Riverpod", "GNOME"] },
  { layer: "Data", items: ["PostgreSQL", "Prisma", "MongoDB", "SQLite", "MySQL", "Redis", "Mongoose", "TypeORM", "SQLAlchemy", "Neon", "Supabase", "Payload CMS"] },
  { layer: "Tooling", items: ["TypeScript", "Go", "Python", "Docker", "GitHub Actions", "JavaScript", "Dart", "C", "Git", "pnpm", "Turborepo"] },
  { layer: "Intelligence", items: ["AI SDK", "Claude Code", "Transformers.js", "Hugging Face", "Claude", "OpenAI", "Gemini", "Mistral", "Qwen", "Ollama", "LangChain", "n8n", "GitHub Copilot", "Codex", "Cursor"] },
  { layer: "Platform", items: ["Linux", "Vercel", "Cloudflare", "AWS", "Google Cloud", "Coolify", "Traefik", "Nginx", "Render", "Sentry", "PostHog", "Grafana", "Datadog"] },
  { layer: "Quality", items: ["Vitest", "Playwright", "Jest", "MSW", "ESLint", "Prettier", "Biome", "Husky"] },
]

// components/home/datasheet.tsx
export const datasheet = {
  title: "The stack, pin by pin.",
  lede: "TypeScript end to end, Swift when it belongs on the Mac, and whatever the problem actually needs underneath.",
}

// lib/content/profile.ts: principles, the datasheet's features
export const principles = [
  {
    title: "Make the wrong thing unrepresentable",
    body: "If a bug can be prevented by the schema, the type system or the database, it should never reach a code review.",
  },
  {
    title: "Boring infrastructure, sharp edges",
    body: "Pick proven tools for the foundation so the time goes into the details people actually touch.",
  },
  {
    title: "Legible software",
    body: "Tools should explain themselves: why a process would not die, why a Mac is awake, why a token is unsafe.",
  },
  {
    title: "Ship, then keep it working",
    body: "CI, security scanning and invariants you can run matter as much as the first release.",
  },
]

// components/home/contact-sheet.tsx
export const contact = {
  title: "Say hello. I read everything.",
  lede: "Email is the fastest way to reach me. For anything that needs a conversation, book a call.",
}

// lib/site.ts socialLinks, plus the postcard's two actions, as a pane of
// stamps: each on a card stock with the other plate under its glyph
export const stamps = [
  { key: "email", label: "email", glyph: "mail", stock: "terracotta", plate: "teal", href: "mailto:contact@khaledsaeed.tech", title: "email / contact@khaledsaeed.tech", alt: "Email contact@khaledsaeed.tech" },
  { key: "call", label: "call", glyph: "calendar", stock: "teal", plate: "terracotta", href: "https://cal.com/khaledsaeed", title: "book a call / cal.com/khaledsaeed", alt: "Book a call on cal.com/khaledsaeed" },
  { key: "vcard", label: "vcard", glyph: "save", stock: "bone", plate: "teal", href: "https://khaledsaeed.tech/khaled-saeed.vcf", title: "save contact / vcard", alt: "Save my contact card (vCard)" },
  { key: "linkedin", label: "linkedin", glyph: "linkedin", stock: "stone", plate: "terracotta", href: "https://www.linkedin.com/in/khaled-s-saeed/", title: "linkedin / khaled-s-saeed", alt: "LinkedIn: khaled-s-saeed" },
  { key: "x", label: "x", glyph: "x", stock: "terracotta", plate: "teal", href: "https://x.com/KhaleddSaeed18", title: "x / @KhaleddSaeed18", alt: "X: @KhaleddSaeed18" },
  { key: "dev", label: "dev", glyph: "devto", stock: "teal", plate: "terracotta", href: "https://dev.to/khaledsaeed18", title: "dev / khaledsaeed18", alt: "DEV: khaledsaeed18" },
  { key: "instagram", label: "instagram", glyph: "instagram", stock: "bone", plate: "teal", href: "https://www.instagram.com/khaledd.saeed", title: "instagram / khaledd.saeed", alt: "Instagram: khaledd.saeed" },
  { key: "discord", label: "discord", glyph: "discord", stock: "stone", plate: "terracotta", href: "https://discord.com/users/1496301841774805004", title: "discord / khaledsaeed18", alt: "Discord: khaledsaeed18" },
]

// The source's back room. The bytes
// spell the site's unlinked page, as its console puzzle does
// (components/console-proof.tsx).
export const secret = "/register"
