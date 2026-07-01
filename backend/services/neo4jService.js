// ═══════════════════════════════════════════════════════════════════════
//  neo4jService.js — Neo4j Aura Cloud Connection & Schema Manager
// ═══════════════════════════════════════════════════════════════════════

import neo4j from 'neo4j-driver';

let driver = null;

// ─── Connection ──────────────────────────────────────────────────────────────

export function getDriver() {
  if (!driver) {
    const uri = process.env.NEO4J_URI;
    const username = process.env.NEO4J_USERNAME;
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !username || !password) {
      throw new Error(
        '[Neo4j] Missing credentials. Ensure NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD are set in .env'
      );
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
      maxConnectionPoolSize: 10,
      connectionAcquisitionTimeout: 10000,
    });
    console.log('[Neo4j] Driver initialised →', uri);
  }
  return driver;
}

export async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
    console.log('[Neo4j] Driver closed.');
  }
}

/**
 * Returns a new session against the configured database.
 * Always call session.close() after use.
 */
export function getSession() {
  return getDriver().session({
    database: process.env.NEO4J_DATABASE || 'neo4j',
  });
}

// ─── Schema Bootstrap ────────────────────────────────────────────────────────

export async function bootstrapSchema() {
  const session = getSession();
  try {
    console.log('[Neo4j] Bootstrapping schema…');

    const queries = [
      `CREATE CONSTRAINT event_id_unique IF NOT EXISTS
       FOR (e:Event) REQUIRE e.id IS UNIQUE`,

      `CREATE CONSTRAINT state_id_unique IF NOT EXISTS
       FOR (s:State) REQUIRE s.id IS UNIQUE`,

      `CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
       FOR (n:Entity) REQUIRE n.id IS UNIQUE`,

      `CREATE INDEX event_timestamp_idx IF NOT EXISTS
       FOR (e:Event) ON (e.timestamp)`,

      `CREATE INDEX event_tier_last_idx IF NOT EXISTS
       FOR (e:Event) ON (e.tier, e.last_accessed)`,

      `CREATE INDEX state_present_attr_idx IF NOT EXISTS
       FOR (s:State) ON (s.present, s.attribute)`,

      `CREATE INDEX entity_name_idx IF NOT EXISTS
       FOR (n:Entity) ON (n.name)`,
    ];

    for (const q of queries) {
      await session.run(q);
    }

    console.log('[Neo4j] Schema ready ✓');
  } finally {
    await session.close();
  }
}

// ─── Connectivity Test ───────────────────────────────────────────────────────

export async function testConnection() {
  const session = getSession();
  try {
    const result = await session.run('RETURN 1 AS ping');
    const ping = result.records[0].get('ping').toNumber();
    return { connected: ping === 1, uri: process.env.NEO4J_URI };
  } catch (err) {
    return { connected: false, error: err.message };
  } finally {
    await session.close();
  }
}
