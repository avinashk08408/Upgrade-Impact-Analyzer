export type ServiceMechanismType =
  | "SLEEPING_WEB_SERVER"
  | "PAUSING_DATABASE"
  | "SCALE_TO_ZERO_DATABASE"
  | "EXPIRING_SERVICE_OR_DATA";

export interface WakeBehavior {
  mechanismType: ServiceMechanismType;
  mechanismLabel: string;
  wakesOnNextRequest: boolean;
  requiresManualResumption: boolean;
  firstRequestLatency: string;
  explanation: string;
  breakcheckDisclaimer: string;
}

export interface BackupSpecification {
  whatIsBackedUp: string;
  whatIsNotBackedUp: string;
  storageLocation: string;
  retentionPeriod: string;
  restoreInstructions: string;
  cacheDisclaimer?: string;
}

export interface AlternativePlatform {
  name: string;
  category: "Relational Database" | "Document Database" | "Web Container / Hosting" | "Serverless Platform" | "Cache / KV";
  freeTierLimits: string;
  freeTierHighlight?: string;
  advantageOverCurrent: string;
  migrationEffort: "ZERO_CODE_CHANGE" | "MINOR_CONFIG_CHANGE" | "CODE_OR_DIALECT_MIGRATION";
  migrationDetails: string;
  officialSourceUrl: string;
  dateVerified: string;
}

export interface AutomatedProtection {
  type: "KEEP_ALIVE" | "AUTOMATED_BACKUP" | "WAKE_ALERT";
  title: string;
  description: string;
  actionableSnippet: string;
  status: "COPYABLE_TEMPLATE";
  statusNotice: string;
  targetFilePath?: string;
  requiredConfiguration?: Record<string, string>;
}

export interface CliffRule {
  id: string;
  provider: string;
  service: string;
  plan: string;
  triggerCondition: string;
  timeToFailure: string;
  impactDescription: string;
  applicabilityNote: string;
  detectionPatterns: {
    files?: string[];
    dependencies?: string[];
    envVariables?: string[];
    contentMatches?: string[];
    negativeContentMatches?: string[];
  };
  recommendedFix: {
    summary: string;
    actionableSnippet?: string;
    documentationUrl: string;
  };
  wakeBehavior: WakeBehavior;
  backupSpecification?: BackupSpecification;
  alternativePlatforms?: AlternativePlatform[];
  automatedProtections?: AutomatedProtection[];
}

export const DEFAULT_CLIFF_RULES: CliffRule[] = [
  {
    id: "supabase-7day-pause",
    provider: "Supabase",
    service: "PostgreSQL Database",
    plan: "Free Tier",
    triggerCondition: "7 consecutive days of zero database reads, writes, or API queries.",
    timeToFailure: "After 7 days of inactivity",
    impactDescription:
      "The database instance is automatically paused by Supabase. Incoming client requests will fail with connection refused or HTTP 503 until manually unpaused via the dashboard.",
    applicabilityNote:
      "Applies strictly to projects hosted on Supabase Free Tier. Does not apply to Supabase Pro ($25/mo), Team, Enterprise, or self-hosted Docker instances.",
    wakeBehavior: {
      mechanismType: "PAUSING_DATABASE",
      mechanismLabel: "Pausing Database (Hard Inactivity Shutdown)",
      wakesOnNextRequest: false,
      requiresManualResumption: true,
      firstRequestLatency: "Connection Refused / HTTP 503 (Requires Manual Unpause)",
      explanation:
        "After 7 consecutive days without user queries or API traffic, Supabase completely shuts down the PostgreSQL database compute instance. The provider DOES NOT wake the database when user traffic arrives; all incoming client requests fail immediately. A developer must log into the Supabase management console and manually click 'Restore project' to resume service.",
      breakcheckDisclaimer:
        "BreakCheck is a local diagnostic tool and cannot wake a paused database. Because Supabase does not support wake-on-query once paused, recovery requires manual dashboard resumption or an automated keep-alive query before the 7-day mark."
    },
    detectionPatterns: {
      dependencies: ["@supabase/supabase-js", "@supabase/ssr", "supabase", "supabase-py"],
      envVariables: [
        "SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_KEY",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY"
      ],
      contentMatches: ["supabase.co"]
    },
    recommendedFix: {
      summary:
        "If hosting on Supabase Free Tier, schedule an automated API heartbeat query every 3 to 4 days (e.g. via GitHub Actions) to reset the 7-day inactivity timer, or upgrade to Supabase Pro to eliminate pausing.",
      actionableSnippet: `name: Keep Supabase Awake
on:
  schedule:
    - cron: '0 4 */3 * *' # Pings database every 3 days
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase REST Endpoint
        run: |
          curl -s -f -X GET "\${{ secrets.SUPABASE_URL }}/rest/v1/" \\
            -H "apikey: \${{ secrets.SUPABASE_ANON_KEY }}" \\
            -H "Authorization: Bearer \${{ secrets.SUPABASE_ANON_KEY }}"`,
      documentationUrl: "https://supabase.com/docs/guides/platform/pausing"
    },
    backupSpecification: {
      whatIsBackedUp:
        "PostgreSQL schemas, tables, views, sequences, triggers, constraints, and data rows exported via pg_dump.",
      whatIsNotBackedUp:
        "Files stored in Supabase Storage buckets, user auth session tokens, edge function code, and dashboard settings are NOT included in pg_dump.",
      storageLocation:
        "Stored as an encrypted artifact in your GitHub Actions workflow run, or uploaded to a secondary storage destination (such as AWS S3 or Cloudflare R2).",
      retentionPeriod:
        "GitHub Actions artifacts are retained for 90 days by default (customizable in repository settings).",
      restoreInstructions:
        "Download the backup.sql file and execute against your target PostgreSQL database: psql \"$TARGET_DATABASE_URL\" < backup.sql",
      cacheDisclaimer:
        "Database tables store persistent user data. Temporary cache entries (such as Redis or in-memory caches) are disposable and do not need inclusion in database backups."
    },
    alternativePlatforms: [
      {
        name: "Neon Serverless Postgres",
        category: "Relational Database",
        freeTierLimits: "0.5 GiB storage, 1 compute endpoint, scales to zero after 5m idle.",
        advantageOverCurrent:
          "Never pauses or locks after 7 days; compute scales to zero and wakes automatically on your next query.",
        migrationEffort: "ZERO_CODE_CHANGE",
        migrationDetails:
          "Direct PostgreSQL drop-in replacement. No SQL or ORM dialect code changes required; only swap the DATABASE_URL connection string.",
        officialSourceUrl: "https://neon.tech/pricing",
        dateVerified: "October 2026"
      },
      {
        name: "Turso Database (libSQL)",
        category: "Relational Database",
        freeTierLimits: "9 GB total storage, 500 databases, 1 billion row reads/month.",
        advantageOverCurrent:
          "Zero inactivity pauses, zero sleep delays, embedded SQLite speed with cloud synchronization.",
        migrationEffort: "CODE_OR_DIALECT_MIGRATION",
        migrationDetails:
          "Requires SQL dialect migration from PostgreSQL to SQLite/libSQL. PostgreSQL-specific features like ENUMs, JSONB operators, and stored procedures must be adapted to SQLite syntax.",
        officialSourceUrl: "https://turso.tech/pricing",
        dateVerified: "October 2026"
      }
    ],
    automatedProtections: [
      {
        type: "KEEP_ALIVE",
        title: "Inactivity Keep-Alive Heartbeat",
        description:
          "Executes a lightweight REST API query every 3 days to keep the project active and reset Supabase's 7-day pause countdown timer.",
        status: "COPYABLE_TEMPLATE",
        statusNotice:
          "Example workflow template. This protection is NOT currently running or active until you commit this file to your repository and configure secrets in GitHub Settings.",
        targetFilePath: ".github/workflows/supabase-keepalive.yml",
        requiredConfiguration: {
          SUPABASE_URL: "Your project URL from Supabase Project Settings -> API (e.g. https://xyz.supabase.co)",
          SUPABASE_ANON_KEY: "Your project public anon API key from Supabase Project Settings -> API"
        },
        actionableSnippet: `# .github/workflows/supabase-keepalive.yml
name: Supabase Inactivity Heartbeat
on:
  schedule:
    - cron: '0 4 */3 * *'
jobs:
  heartbeat:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase REST Endpoint
        run: |
          curl -s -f -X GET "\${{ secrets.SUPABASE_URL }}/rest/v1/" \\
            -H "apikey: \${{ secrets.SUPABASE_ANON_KEY }}" \\
            -H "Authorization: Bearer \${{ secrets.SUPABASE_ANON_KEY }}"`
      },
      {
        type: "AUTOMATED_BACKUP",
        title: "Pre-Deadline Automated Snapshot Export",
        description:
          "Takes a complete pg_dump snapshot of schema and data before any inactivity pause, uploading the backup to secure artifact storage.",
        status: "COPYABLE_TEMPLATE",
        statusNotice:
          "Example backup workflow. Not active until committed to .github/workflows/ and configured with database credentials.",
        targetFilePath: ".github/workflows/supabase-backup.yml",
        requiredConfiguration: {
          SUPABASE_DB_URL: "PostgreSQL connection string with transaction pooler URI from Supabase Project Settings -> Database"
        },
        actionableSnippet: `# .github/workflows/supabase-backup.yml
name: Pre-Deadline Database Backup
on:
  schedule:
    - cron: '0 2 */5 * *' # Runs every 5 days
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Install PostgreSQL Client
        run: sudo apt-get update && sudo apt-get install -y postgresql-client
      - name: Export Postgres Dump
        run: |
          pg_dump "\${{ secrets.SUPABASE_DB_URL }}" -F p -b -v -f "supabase_backup_\$(date +%Y%m%d).sql"
      - name: Upload Snapshot Artifact
        uses: actions/upload-artifact@v4
        with:
          name: supabase-snapshot
          path: supabase_backup_*.sql`
      }
    ]
  },
  {
    id: "render-15min-spindown",
    provider: "Render",
    service: "Web Service",
    plan: "Free Instance",
    triggerCondition: "15 minutes of zero inbound HTTP traffic.",
    timeToFailure: "After 15 minutes without traffic",
    impactDescription:
      "Free web services spin down to zero instances. The next incoming HTTP request experiences a cold start delay of 50+ seconds while the container reboots.",
    applicabilityNote:
      "Applies only to Render services running on plan: free. Does not apply to Starter ($7/mo), Standard, or Pro paid instances.",
    wakeBehavior: {
      mechanismType: "SLEEPING_WEB_SERVER",
      mechanismLabel: "Sleeping Website Server (Auto-Sleep / Spin-Down)",
      wakesOnNextRequest: true,
      requiresManualResumption: false,
      firstRequestLatency: "50+ seconds cold start delay on first request",
      explanation:
        "Render free web services spin down after 15 minutes of zero inbound HTTP traffic. The provider automatically intercepts the next incoming HTTP request and boots the container. The first visitor experiences a delay of 50 seconds or longer (or an HTTP 504 gateway timeout if their browser or client times out). Once booted, subsequent requests respond immediately until the next 15-minute idle period.",
      breakcheckDisclaimer:
        "BreakCheck runs locally on your machine and cannot keep your remote Render instance warm. Waking on request is handled automatically by Render's reverse proxy."
    },
    detectionPatterns: {
      files: ["render.yaml", "render.yml"],
      contentMatches: ["plan: free", "type: web"],
      negativeContentMatches: ["plan: starter", "plan: standard", "plan: pro"]
    },
    recommendedFix: {
      summary:
        "If deployed on Render Free Web Service, configure an external uptime monitor (ping every 10 min) to prevent sleep, or upgrade the service plan to Starter ($7/mo) in render.yaml.",
      actionableSnippet: "// In server health check endpoint: GET /api/health returns 200 OK every 10 minutes",
      documentationUrl: "https://render.com/docs/free#spinning-down-on-idle"
    },
    alternativePlatforms: [
      {
        name: "Koyeb Free Tier",
        category: "Web Container / Hosting",
        freeTierLimits: "1 web service with 512MB RAM, 0.1 vCPU, 2GB SSD.",
        advantageOverCurrent:
          "Runs continuously without 15-minute container shutdown; avoids 50-second cold starts.",
        migrationEffort: "MINOR_CONFIG_CHANGE",
        migrationDetails:
          "Standard Docker or buildpack deployment. Requires connecting your GitHub repository in the Koyeb console; no backend application code changes.",
        officialSourceUrl: "https://www.koyeb.com/pricing",
        dateVerified: "October 2026"
      },
      {
        name: "Fly.io",
        category: "Web Container / Hosting",
        freeTierLimits: "Free allowance covers shared-cpu-1x 256MB micro VMs.",
        advantageOverCurrent:
          "Fine-grained control over idle machines; auto-start latency is typically under 1 second instead of 50+ seconds.",
        migrationEffort: "MINOR_CONFIG_CHANGE",
        migrationDetails:
          "Requires creating a fly.toml configuration file; standard container deployment.",
        officialSourceUrl: "https://fly.io/docs/about/pricing/",
        dateVerified: "October 2026"
      }
    ],
    automatedProtections: [
      {
        type: "KEEP_ALIVE",
        title: "10-Minute Anti-Sleep Ping Worker",
        description:
          "Sends an HTTP HEAD or GET request to /api/health every 10 minutes to prevent Render's 15-minute idle countdown from ever triggering.",
        status: "COPYABLE_TEMPLATE",
        statusNotice:
          "Example workflow template. This keep-alive is NOT active until you add the workflow to GitHub Actions and set RENDER_APP_HOSTNAME.",
        targetFilePath: ".github/workflows/render-keepalive.yml",
        requiredConfiguration: {
          RENDER_APP_HOSTNAME: "Your Render service hostname without protocol (e.g. my-app.onrender.com) added to GitHub Repository Secrets",
          "/api/health": "A lightweight HTTP endpoint in your web server that returns 200 OK without executing heavy database queries"
        },
        actionableSnippet: `# .github/workflows/render-keepalive.yml
name: Prevent Render Free Service Sleep
on:
  schedule:
    - cron: '*/10 * * * *' # Every 10 minutes
jobs:
  keepalive:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Service Health Endpoint
        run: |
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://\${{ secrets.RENDER_APP_HOSTNAME }}/api/health)
          echo "Keep-alive response: $STATUS"`
      },
      {
        type: "WAKE_ALERT",
        title: "Sleep-Time Request Detection & Webhook Alert",
        description:
          "Middleware that detects cold boots, logs when a client request arrived while the instance was asleep, and dispatches a webhook notification.",
        status: "COPYABLE_TEMPLATE",
        statusNotice:
          "Express/Node.js middleware snippet. Not active until integrated into your backend application entrypoint.",
        requiredConfiguration: {
          DISCORD_WEBHOOK_URL: "Incoming webhook URL created in your Discord or Slack channel for receiving cold boot alerts"
        },
        actionableSnippet: `// In your Express / Node.js entry point:
const bootTimestamp = Date.now();
app.use((req, res, next) => {
  const uptimeSeconds = (Date.now() - bootTimestamp) / 1000;
  if (uptimeSeconds < 10 && !req.headers['x-health-ping']) {
    console.warn(\`[ALERT] Cold request arrived after sleep at \${new Date().toISOString()} from \${req.ip}\`);
    // Optionally trigger a Discord or Slack notification webhook here
  }
  next();
});`
      }
    ]
  },
  {
    id: "neon-compute-suspend",
    provider: "Neon",
    service: "Serverless Postgres",
    plan: "Free Tier",
    triggerCondition: "5 minutes of inactive database connections.",
    timeToFailure: "After 5 minutes of connection inactivity",
    impactDescription:
      "Compute instances scale down to zero. The subsequent query experiences a cold start latency penalty of 500ms to 2000ms while compute boots.",
    applicabilityNote:
      "Applies to Neon Free Tier. Does not apply to paid compute tiers with minimum compute provisioned.",
    wakeBehavior: {
      mechanismType: "SCALE_TO_ZERO_DATABASE",
      mechanismLabel: "Scale-to-Zero Database (Automatic Compute Suspend)",
      wakesOnNextRequest: true,
      requiresManualResumption: false,
      firstRequestLatency: "500ms to 2000ms cold start query latency",
      explanation:
        "Neon compute endpoints scale down to zero after 5 minutes of no active database connections. When your application sends a new SQL query, the Neon connection proxy automatically starts the compute. The first query will experience a 500ms-2000ms cold start latency. It does NOT pause for 7 days or require manual dashboard resumption.",
      breakcheckDisclaimer:
        "BreakCheck is a local diagnostic tool and cannot wake or manage your remote database. Compute wake-up is handled automatically by Neon's serverless connection proxy."
    },
    detectionPatterns: {
      dependencies: ["@neondatabase/serverless"],
      envVariables: ["DATABASE_URL", "NEON_DATABASE_URL"],
      contentMatches: ["neon.tech"]
    },
    recommendedFix: {
      summary:
        "If using Neon Free Tier, route queries through Neon's connection pooler endpoint (-pooler host suffix) to minimize cold connection latency.",
      documentationUrl: "https://neon.tech/docs/introduction/scale-to-zero"
    },
    backupSpecification: {
      whatIsBackedUp:
        "PostgreSQL schemas, tables, and rows exported via pg_dump or Neon branch snapshots.",
      whatIsNotBackedUp:
        "Application files, local filesystem state, and serverless compute caches are NOT included.",
      storageLocation:
        "Stored in GitHub Actions encrypted artifacts, S3 storage, or a dedicated Neon snapshot branch.",
      retentionPeriod:
        "90 days for GitHub Actions artifacts; Neon branch snapshots persist until deleted.",
      restoreInstructions:
        "Restore via psql: psql \"$TARGET_DATABASE_URL\" < neon_backup.sql or switch connection strings to a restored Neon branch.",
      cacheDisclaimer:
        "Relational tables are persistent data. Caches are ephemeral and do not require backup unless acting as a primary store."
    },
    alternativePlatforms: [
      {
        name: "Supabase Postgres",
        category: "Relational Database",
        freeTierLimits: "500MB relational database, built-in PgBouncer connection pooler.",
        advantageOverCurrent:
          "Built-in connection pooler for always-on pooling; 500MB free storage.",
        migrationEffort: "ZERO_CODE_CHANGE",
        migrationDetails:
          "Direct PostgreSQL drop-in replacement. Only replace DATABASE_URL.",
        officialSourceUrl: "https://supabase.com/pricing",
        dateVerified: "October 2026"
      },
      {
        name: "Turso (libSQL)",
        category: "Relational Database",
        freeTierLimits: "9 GB storage, zero compute sleep",
        advantageOverCurrent:
          "Instant edge responses without cold start delay on idle connection resumption.",
        migrationEffort: "CODE_OR_DIALECT_MIGRATION",
        migrationDetails:
          "Requires migrating PostgreSQL schema and queries to SQLite/libSQL dialect.",
        officialSourceUrl: "https://turso.tech/pricing",
        dateVerified: "October 2026"
      }
    ]
  },
  {
    id: "vercel-10s-timeout",
    provider: "Vercel",
    service: "Serverless Functions",
    plan: "Hobby Plan",
    triggerCondition: "Any backend API route or serverless function executing longer than configured timeout.",
    timeToFailure: "Terminated at 10 to 300 seconds (depending on runtime configuration)",
    impactDescription:
      "The function execution is aborted with a FUNCTION_INVOCATION_TIMEOUT error (HTTP 504). Long-running operations like AI prompt generation, file processing, or PDF rendering will fail midway.",
    applicabilityNote:
      "Applies to Vercel Hobby accounts. Default execution timeout is 10-15s (without maxDuration) or up to 300s on Fluid Compute. Does not support >300s without Vercel Pro or Enterprise.",
    wakeBehavior: {
      mechanismType: "EXPIRING_SERVICE_OR_DATA",
      mechanismLabel: "Function Execution Timeout (Hard Execution Limit)",
      wakesOnNextRequest: true,
      requiresManualResumption: false,
      firstRequestLatency: "Terminated with HTTP 504 if execution exceeds limit",
      explanation:
        "Serverless functions on Vercel are event-driven. They do not sleep, but they are subject to a strict execution time cap. If an API request executes longer than the plan threshold, Vercel forcefully terminates the function. Keep-alive pings do NOT prevent this timeout because it occurs during active execution.",
      breakcheckDisclaimer:
        "BreakCheck cannot extend function execution limits. Long-running tasks must be migrated to background job queues or upgraded to Vercel Pro."
    },
    detectionPatterns: {
      files: ["vercel.json", "next.config.js", "next.config.mjs", "next.config.ts"],
      contentMatches: ["vercel"],
      negativeContentMatches: ["maxDuration: 600", "maxDuration: 900"]
    },
    recommendedFix: {
      summary:
        "If hosting on Vercel Hobby, delegate tasks exceeding function limits to asynchronous background job queues (Upstash QStash, Inngest) or upgrade to Pro.",
      documentationUrl: "https://vercel.com/docs/functions/serverless-functions/runtimes#max-duration"
    },
    alternativePlatforms: [
      {
        name: "Cloudflare Workers",
        category: "Serverless Platform",
        freeTierLimits: "100k requests/day, unmetered wall-clock streaming I/O.",
        advantageOverCurrent:
          "No arbitrary 10-second wall-clock termination for streaming or external API calls.",
        migrationEffort: "CODE_OR_DIALECT_MIGRATION",
        migrationDetails:
          "Requires adapting Node.js-specific modules to Web Standards API (fetch, Request, Response).",
        officialSourceUrl: "https://developers.cloudflare.com/workers/platform/pricing/",
        dateVerified: "October 2026"
      },
      {
        name: "Render Background Worker",
        category: "Web Container / Hosting",
        freeTierLimits: "Continuous long-running service execution.",
        advantageOverCurrent:
          "True container runtime without serverless execution timeouts.",
        migrationEffort: "MINOR_CONFIG_CHANGE",
        migrationDetails:
          "Decouple heavy tasks from HTTP request lifecycle into a worker process.",
        officialSourceUrl: "https://render.com/pricing",
        dateVerified: "October 2026"
      }
    ]
  },
  {
    id: "mongodb-atlas-60day-inactivity",
    provider: "MongoDB Atlas",
    service: "Shared Cluster (M0)",
    plan: "Free Shared",
    triggerCondition: "30 to 60 consecutive days of zero database connections, or exceeding 512 MB storage.",
    timeToFailure: "After 30 days of inactivity or at 512MB quota",
    impactDescription:
      "The cluster is paused after 30 days of inactivity (having zero connections). If the 512 MB data storage cap is exceeded, all write operations fail immediately with quota exceeded errors.",
    applicabilityNote:
      "Applies strictly to Atlas M0 Sandbox clusters. Does not apply to M10+ dedicated clusters or Serverless instances.",
    wakeBehavior: {
      mechanismType: "PAUSING_DATABASE",
      mechanismLabel: "Pausing Database (Inactivity Shutdown & 512MB Storage Cap)",
      wakesOnNextRequest: false,
      requiresManualResumption: true,
      firstRequestLatency: "Connection Refused (Requires Manual Dashboard Resume)",
      explanation:
        "Atlas Free clusters automatically pause after 30 consecutive days of inactivity (zero active connections). When paused, the provider DOES NOT wake the cluster upon incoming connection attempts; all application queries fail until a developer logs into the Atlas console and clicks 'Resume'. Additionally, write operations fail immediately if stored documents exceed 512 MB.",
      breakcheckDisclaimer:
        "BreakCheck is a local scanner and cannot resume paused MongoDB Atlas clusters. Resumption requires logging into cloud.mongodb.com."
    },
    detectionPatterns: {
      dependencies: ["mongoose", "mongodb", "pymongo", "motor"],
      envVariables: ["MONGODB_URI", "MONGO_URL", "MONGODB_URL"],
      contentMatches: ["mongodb+srv://", "mongodb://"]
    },
    recommendedFix: {
      summary:
        "If using an M0 Sandbox cluster, ensure periodic automated queries run within 25-day windows and monitor storage to stay under 450 MB.",
      documentationUrl: "https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/"
    },
    backupSpecification: {
      whatIsBackedUp:
        "MongoDB collections, BSON documents, indexes, and metadata exported via mongodump.",
      whatIsNotBackedUp:
        "File uploads stored outside MongoDB (e.g. S3), server logs, and user sessions are NOT included.",
      storageLocation:
        "Stored as a compressed .gz archive artifact in GitHub Actions or transferred to private S3 bucket storage.",
      retentionPeriod:
        "90 days in GitHub Actions artifacts by default.",
      restoreInstructions:
        "Restore via mongorestore: mongorestore --uri=\"$TARGET_MONGODB_URI\" --gzip --archive=atlas_backup.gz",
      cacheDisclaimer:
        "Application caches are ephemeral. Only collections storing business-critical user data require regular automated backup."
    },
    alternativePlatforms: [
      {
        name: "Supabase Database with JSONB",
        category: "Document Database",
        freeTierLimits: "500MB relational storage with JSONB support, 50,000 monthly active users.",
        advantageOverCurrent:
          "Full document-store capabilities using PostgreSQL JSONB with REST and Realtime APIs.",
        migrationEffort: "CODE_OR_DIALECT_MIGRATION",
        migrationDetails:
          "Requires application code migration: replacing MongoDB/Mongoose BSON queries with PostgreSQL JSONB queries (e.g. using Prisma, Drizzle, or pg).",
        officialSourceUrl: "https://supabase.com/pricing",
        dateVerified: "October 2026"
      },
      {
        name: "MongoDB Atlas Dedicated / Serverless",
        category: "Document Database",
        freeTierLimits: "Pay-as-you-go or dedicated cluster.",
        advantageOverCurrent:
          "Zero inactivity pauses and eliminates the 512MB storage cap.",
        migrationEffort: "ZERO_CODE_CHANGE",
        migrationDetails:
          "Zero application code changes; upgrade cluster directly in the MongoDB Atlas console.",
        officialSourceUrl: "https://www.mongodb.com/pricing",
        dateVerified: "October 2026"
      }
    ],
    automatedProtections: [
      {
        type: "AUTOMATED_BACKUP",
        title: "Pre-Deadline Database Snapshot Export",
        description:
          "Executes a mongodump export script to safely archive all collections before reaching the inactivity threshold.",
        status: "COPYABLE_TEMPLATE",
        statusNotice:
          "Example backup script. This protection is NOT currently running or active until integrated into your scheduled backup pipeline.",
        targetFilePath: ".github/workflows/mongodb-backup.yml",
        requiredConfiguration: {
          MONGODB_URI: "MongoDB Atlas connection string stored in GitHub Repository Secrets"
        },
        actionableSnippet: `# Export MongoDB collection data before inactivity deadline:
mongodump --uri="\$MONGODB_URI" --gzip --archive=atlas_backup_\$(date +%Y%m%d).gz`
      }
    ]
  },
  {
    id: "upstash-redis-30day-deletion",
    provider: "Upstash",
    service: "Serverless Redis",
    plan: "Free Tier",
    triggerCondition: "30 consecutive days of zero commands or exceeding daily command caps.",
    timeToFailure: "After 30 days of inactivity",
    impactDescription:
      "Free tier databases with zero commands for 30 consecutive days are archived and deactivated. If used as a primary store without backups, data recovery requires recreating the database.",
    applicabilityNote:
      "Applies to Upstash Redis Free Tier. Does not apply to Pro or Pay-As-You-Go accounts.",
    wakeBehavior: {
      mechanismType: "EXPIRING_SERVICE_OR_DATA",
      mechanismLabel: "Expiring Service / Archival on Inactivity",
      wakesOnNextRequest: false,
      requiresManualResumption: true,
      firstRequestLatency: "Connection Error (Database Archived)",
      explanation:
        "Free tier databases with zero commands over 30 consecutive days are archived by Upstash to reclaim resources. The provider does not wake the database automatically on incoming connections. You must log into the Upstash console to restore from archive or create a new database.",
      breakcheckDisclaimer:
        "BreakCheck cannot restore archived Upstash databases. Regularly query the database or upgrade to pay-as-you-go to prevent archival."
    },
    detectionPatterns: {
      dependencies: ["@upstash/redis", "@upstash/ratelimit", "ioredis", "redis"],
      envVariables: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "REDIS_URL"],
      contentMatches: ["upstash.io"]
    },
    recommendedFix: {
      summary:
        "If using Upstash Redis Free Tier, ensure scheduled tasks execute at least once every 25 days, or use Redis strictly as a disposable cache.",
      documentationUrl: "https://upstash.com/docs/redis/overall/pricing"
    },
    backupSpecification: {
      whatIsBackedUp:
        "Redis key-value pairs, hashes, lists, and sets.",
      whatIsNotBackedUp:
        "Keys with expired TTLs are purged automatically.",
      storageLocation:
        "Encrypted GitHub Actions artifact or external cloud storage.",
      retentionPeriod:
        "90 days in GitHub Actions.",
      restoreInstructions:
        "Replay exported Redis keys into your target Redis instance using redis-cli or REST API.",
      cacheDisclaimer:
        "Important: Treat caches as disposable. If Redis is only used for temporary session caching, rate limiting, or page caching, do NOT set up backup pipelines because cached data can be reconstructed from your primary database on demand. Only back up Redis if your application uses it as a primary persistent datastore."
    },
    alternativePlatforms: [
      {
        name: "Cloudflare KV",
        category: "Cache / KV",
        freeTierLimits: "100,000 reads/day, 1,000 writes/day, 1GB storage.",
        advantageOverCurrent:
          "Global edge key-value storage with zero inactivity archival.",
        migrationEffort: "CODE_OR_DIALECT_MIGRATION",
        migrationDetails:
          "Requires updating key-value read/write calls to the Cloudflare KV Web API.",
        officialSourceUrl: "https://developers.cloudflare.com/kv/platform/pricing/",
        dateVerified: "October 2026"
      }
    ]
  },
  {
    id: "railway-credit-exhaustion",
    provider: "Railway",
    service: "Containers",
    plan: "Trial Plan",
    triggerCondition: "Exhaustion of monthly $5.00 trial execution credit (~500 compute hours).",
    timeToFailure: "Mid-month after continuous execution",
    impactDescription:
      "All services and containers are halted simultaneously when the $5.00 credit is reached, remaining offline until the next calendar month.",
    applicabilityNote:
      "Applies only to unverified Railway trial accounts. Does not apply to accounts with a payment method attached on pay-as-you-go.",
    wakeBehavior: {
      mechanismType: "EXPIRING_SERVICE_OR_DATA",
      mechanismLabel: "Expiring Service (Credit Exhaustion Shutdown)",
      wakesOnNextRequest: false,
      requiresManualResumption: true,
      firstRequestLatency: "All containers halted (HTTP 502 / Offline)",
      explanation:
        "Railway trial accounts receive a fixed monthly credit. When the credit is exhausted, all containers are stopped immediately. Traffic cannot wake the containers until credits renew on the first of the month or a payment method is added.",
      breakcheckDisclaimer:
        "BreakCheck cannot grant compute credits or resume exhausted containers."
    },
    detectionPatterns: {
      files: ["railway.json", "railway.toml", "Procfile"],
      contentMatches: ["railway.app"]
    },
    recommendedFix: {
      summary:
        "If hosting on Railway Trial, attach a credit card for unmetered usage, or configure services to pause outside active hours.",
      documentationUrl: "https://docs.railway.app/reference/pricing"
    }
  },
  {
    id: "fly-autostop-delay",
    provider: "Fly.io",
    service: "Fly Machines",
    plan: "Free Allowance",
    triggerCondition: "Machines configured with auto_stop_machines = true when idle.",
    timeToFailure: "After connection pool drains",
    impactDescription:
      "Machines stop running to preserve compute hours, adding a 1-3 second latency penalty on the next incoming TCP connection while the machine boots.",
    applicabilityNote:
      "Applies only if auto_stop_machines is enabled in fly.toml.",
    wakeBehavior: {
      mechanismType: "SLEEPING_WEB_SERVER",
      mechanismLabel: "Sleeping Web Server (Micro VM Auto-Stop)",
      wakesOnNextRequest: true,
      requiresManualResumption: false,
      firstRequestLatency: "1 to 3 seconds wake-up delay",
      explanation:
        "When auto_stop_machines is enabled in fly.toml, idle Fly Machines shut down. When a new incoming TCP connection arrives, Fly's edge proxy automatically restarts the machine in 1-3 seconds.",
      breakcheckDisclaimer:
        "BreakCheck does not manage machine states. Wake-on-connection is handled by Fly's proxy."
    },
    detectionPatterns: {
      files: ["fly.toml"],
      contentMatches: ["auto_stop_machines = true", "auto_stop_machines = 'stop'"],
      negativeContentMatches: ["min_machines_running = 1", "auto_stop_machines = false"]
    },
    recommendedFix: {
      summary:
        "Set min_machines_running = 1 in fly.toml if zero-latency first response is critical, or maintain an active connection.",
      documentationUrl: "https://fly.io/docs/apps/autostop-autostart/"
    }
  }
];
