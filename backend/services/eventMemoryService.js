// ═══════════════════════════════════════════════════════════════════════
//  eventMemoryService.js — Event-Native Memory System
//
//  Pipeline:
//   Stage 1 — Ingestion:    Store raw Events & States in Neo4j
//   Stage 2 — Retrieval:    MemTree / A-MEM (HOT → WARM → COLD)
//   Stage 3 — Late Filter:  Precision screening before LLM context
//   Stage 4 — Maintenance:  Tier aging, conflict resolution, dedup
// ═══════════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid';
import { getSession } from './neo4jService.js';
import { openai, MODEL_NAME } from '../models/clients.js';

// ─── Helper ──────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();

// ─── STAGE 1: INGESTION ──────────────────────────────────────────────────────

/**
 * Store a raw immutable Event node.
 * Events enter at HOT tier. They never carry a present/past tag.
 *
 * @param {object} event
 * @param {string} event.actor    - "User" | "System" | "Manager"
 * @param {string} event.action   - "OPENED" | "SAID" | "CLICKED" | etc.
 * @param {string} event.object   - "Docker" | "YouTube" | etc.
 * @param {string} event.raw_content - Full raw transcription / OCR text
 * @param {string} event.source   - "audio" | "screen" | "video" | "tool"
 * @param {string[]} event.topic_tags
 * @param {object}  event.video_ref - { video_id, timestamp_seconds }
 */
export async function ingestEvent(event, deviceId = 'DEV-DEFAULT') {
  const session = getSession();
  const id = uuidv4();
  const timestamp = event.timestamp || now();

  try {
    const result = await session.run(
      `CREATE (e:Event:Hot {
        id:           $id,
        timestamp:    $timestamp,
        deviceId:     $deviceId,
        actor:        $actor,
        action:       $action,
        object:       $object,
        raw_content:  $raw_content,
        source:       $source,
        topic_tags:   $topic_tags,
        video_ref:    $video_ref,
        tier:         'hot',
        access_count: 0,
        last_accessed: $timestamp
      }) RETURN e`,
      {
        id,
        timestamp,
        deviceId,
        actor: event.actor || 'User',
        action: event.action || 'ACTION',
        object: event.object || '',
        raw_content: event.raw_content || '',
        source: event.source || 'audio',
        topic_tags: event.topic_tags || [],
        video_ref: JSON.stringify(event.video_ref || {}),
      }
    );

    const node = result.records[0].get('e').properties;
    console.log(`[Memory] Event stored → ${node.action} "${node.object}" [HOT]`);
    return node;
  } finally {
    await session.close();
  }
}

/**
 * Store or update a mutable State node.
 * If a present=true state for this attribute already exists, Maintenance is
 * triggered to archive it and create a fresh present=true node.
 *
 * @param {object} state
 * @param {string} state.entity_name  - "User" | "Manager" | etc.
 * @param {string} state.attribute    - "WORKS_AT" | "WORKS_ON" | "USES_EDITOR"
 * @param {string} state.value        - "Company A" | "VS Code" | etc.
 */
export async function ingestState(state, deviceId = 'DEV-DEFAULT') {
  const session = getSession();
  const newId = uuidv4();
  const timestamp = now();

  try {
    // 1. Check for an existing present=true state for this attribute
    const existing = await session.run(
      `MATCH (s:State {attribute: $attribute, present: true})
       WHERE s.deviceId = $deviceId OR s.deviceId IS NULL
       RETURN s`,
      { attribute: state.attribute, deviceId }
    );

    if (existing.records.length > 0) {
      const old = existing.records[0].get('s').properties;

      if (old.value === state.value) {
        // No change — skip
        console.log(`[Memory] State unchanged: ${state.attribute} = "${state.value}"`);
        return old;
      }

      // Conflict detected — archive old state and create new one
      console.log(`[Memory] State conflict: ${state.attribute} changing from "${old.value}" → "${state.value}"`);
      await session.run(
        `MATCH (s:State {id: $old_id})
         SET s.present = false, s.valid_to = $timestamp`,
        { old_id: old.id, timestamp }
      );
    }

    // 2. Ensure the Entity node exists (MERGE)
    await session.run(
      `MERGE (n:Entity {name: $name, deviceId: $deviceId})
       ON CREATE SET n.id = $entity_id, n.type = 'Person'`,
      { name: state.entity_name || 'User', deviceId, entity_id: uuidv4() }
    );

    // 3. Create new present=true State
    const result = await session.run(
      `MATCH (n:Entity {name: $entity_name, deviceId: $deviceId})
       CREATE (s:State {
         id:         $id,
         deviceId:   $deviceId,
         attribute:  $attribute,
         value:      $value,
         present:    true,
         valid_from: $timestamp,
         valid_to:   null
       })
       CREATE (n)-[:HAS_STATE]->(s)
       RETURN s`,
      {
        entity_name: state.entity_name || 'User',
        id: newId,
        deviceId,
        attribute: state.attribute,
        value: state.value,
        timestamp,
      }
    );

    const node = result.records[0].get('s').properties;
    console.log(`[Memory] State stored → ${state.attribute} = "${state.value}" [present=true]`);
    return node;
  } finally {
    await session.close();
  }
}

// ─── STAGE 2: RETRIEVAL (MemTree / A-MEM pattern) ───────────────────────────

/**
 * Retrieve candidate Event nodes.
 * Searches HOT first, then WARM, then COLD until enough candidates are found.
 * Promotes accessed events up one tier and increments access_count.
 *
 * @param {string} queryText - Free-text keywords from user question
 * @param {string[]} topicTags - Optional topic hints to filter by
 * @param {number} limit - Max candidates to return (default 30)
 * @returns {object[]} Array of Event node properties
 */
export async function retrieveCandidates(queryText, topicTags = [], limit = 30, deviceId = 'DEV-DEFAULT') {
  const session = getSession();
  const accessedNow = now();

  try {
    const keywords = queryText
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    // Build Cypher WHERE clause for keyword matching across raw_content, action, object
    // Also supports topic_tag filtering
    const tierOrder = ['hot', 'warm', 'cold'];
    let allCandidates = [];

    for (const tier of tierOrder) {
      const result = await session.run(
        `MATCH (e:Event {tier: $tier})
         WHERE (e.deviceId = $deviceId OR e.deviceId IS NULL) AND (
           any(kw IN $keywords WHERE
             toLower(e.raw_content) CONTAINS kw OR
             toLower(e.action) CONTAINS kw OR
             toLower(e.object) CONTAINS kw OR
             toLower(e.actor) CONTAINS kw
           )
           OR size($topicTags) > 0 AND any(t IN $topicTags WHERE t IN e.topic_tags)
         )
         RETURN e
         ORDER BY e.timestamp DESC
         LIMIT $limit`,
        {
          tier,
          deviceId,
          keywords,
          topicTags,
          limit: neo4jInt(limit),
        }
      );

      const nodes = result.records.map((r) => r.get('e').properties);
      allCandidates = [...allCandidates, ...nodes];

      if (allCandidates.length >= limit) break;
    }

    // Promote accessed events and update access_count
    if (allCandidates.length > 0) {
      const ids = allCandidates.map((e) => e.id);
      await session.run(
        `UNWIND $ids AS eid
         MATCH (e:Event {id: eid})
         SET e.access_count = e.access_count + 1,
             e.last_accessed = $accessedNow,
             e.tier = CASE
               WHEN e.tier = 'cold' THEN 'warm'
               WHEN e.tier = 'warm' AND e.access_count > 5 THEN 'hot'
               ELSE e.tier
             END
         REMOVE e:Hot REMOVE e:Warm REMOVE e:Cold
         WITH e,
           CASE e.tier WHEN 'hot' THEN 1 WHEN 'warm' THEN 2 ELSE 3 END AS tierNum
         CALL apoc.do.case([
           tierNum = 1, 'SET e:Hot',
           tierNum = 2, 'SET e:Warm'
         ], 'SET e:Cold', {e: e}) YIELD value
         RETURN value`,
        { ids, accessedNow }
      ).catch(() => {
        // If APOC not available on Aura Free, use simpler update
        return session.run(
          `UNWIND $ids AS eid
           MATCH (e:Event {id: eid})
           SET e.access_count = e.access_count + 1,
               e.last_accessed = $accessedNow`,
          { ids, accessedNow }
        );
      });
    }

    console.log(`[Memory] Retrieved ${allCandidates.length} candidates for: "${queryText}"`);
    return allCandidates;
  } finally {
    await session.close();
  }
}

/**
 * Retrieve current active States (present=true).
 */
export async function retrieveCurrentStates(deviceId = 'DEV-DEFAULT') {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (n:Entity)-[:HAS_STATE]->(s:State {present: true})
       WHERE s.deviceId = $deviceId OR s.deviceId IS NULL
       RETURN n.name AS entity, s
       ORDER BY s.attribute`,
      { deviceId }
    );
    return result.records.map((r) => ({
      entity: r.get('entity'),
      ...r.get('s').properties,
    }));
  } finally {
    await session.close();
  }
}

/**
 * Retrieve historical States (present=false).
 */
export async function retrievePastStates(attribute = null, deviceId = 'DEV-DEFAULT') {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (n:Entity)-[:HAS_STATE]->(s:State {present: false})
       WHERE (s.deviceId = $deviceId OR s.deviceId IS NULL) AND ($attribute IS NULL OR s.attribute = $attribute)
       RETURN n.name AS entity, s
       ORDER BY s.valid_from DESC`,
      { attribute, deviceId }
    );
    return result.records.map((r) => ({
      entity: r.get('entity'),
      ...r.get('s').properties,
    }));
  } finally {
    await session.close();
  }
}

// ─── STAGE 3: LATE FILTERING ─────────────────────────────────────────────────

/**
 * Filters a candidate list down to only the events relevant to the query.
 * This runs after MemTree retrieval, before sending context to the LLM.
 *
 * Scoring logic:
 *  - +3 per keyword found in raw_content
 *  - +2 per keyword found in action/object
 *  - +1 per matching topic_tag
 *  - +0.5 recency boost (hot=3, warm=2, cold=1) normalised
 *
 * @param {object[]} candidates - Array of Event properties
 * @param {string} queryText
 * @param {number} topK - Keep top K results (default 10)
 */
export function lateFilter(candidates, queryText, topK = 10) {
  const keywords = queryText
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const tierBoost = { hot: 3, warm: 2, cold: 1 };

  const scored = candidates.map((event) => {
    let score = 0;
    const content = (event.raw_content || '').toLowerCase();
    const action = (event.action || '').toLowerCase();
    const object = (event.object || '').toLowerCase();
    const tags = event.topic_tags || [];

    for (const kw of keywords) {
      if (content.includes(kw)) score += 3;
      if (action.includes(kw) || object.includes(kw)) score += 2;
    }

    for (const tag of tags) {
      if (keywords.some((kw) => tag.toLowerCase().includes(kw))) score += 1;
    }

    score += (tierBoost[event.tier] || 1) * 0.5;

    return { ...event, _score: score };
  });

  const filtered = scored
    .filter((e) => e._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, topK);

  console.log(
    `[Memory] Late filter: ${candidates.length} candidates → ${filtered.length} kept`
  );
  return filtered;
}

// ─── STAGE 4: MAINTENANCE ────────────────────────────────────────────────────

/**
 * Tier Aging — downgrade events that haven't been accessed recently.
 * Hot  = 1 day (HOT → WARM if last_accessed > 1 day ago)
 * Warm = 5 days (WARM → COLD if last_accessed > 5 days ago)
 * Cold = infinity until explicit deletion
 */
export async function runTierAging() {
  const session = getSession();
  const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // HOT → WARM (> 1 day)
    const warmResult = await session.run(
      `MATCH (e:Event:Hot)
       WHERE e.last_accessed < $cutoff
       SET e.tier = 'warm'
       REMOVE e:Hot
       SET e:Warm
       RETURN count(e) AS aged`,
      { cutoff: oneDayAgo }
    );
    const agedToWarm = warmResult.records[0]?.get('aged')?.toNumber() ?? 0;

    // WARM → COLD (> 5 days)
    const coldResult = await session.run(
      `MATCH (e:Event:Warm)
       WHERE e.last_accessed < $cutoff
       SET e.tier = 'cold'
       REMOVE e:Warm
       SET e:Cold
       RETURN count(e) AS aged`,
      { cutoff: fiveDaysAgo }
    );
    const agedToCold = coldResult.records[0]?.get('aged')?.toNumber() ?? 0;

    if (agedToWarm > 0 || agedToCold > 0) {
      console.log(`[Memory] Tier aging executed: ${agedToWarm} events → WARM (1d), ${agedToCold} events → COLD (5d)`);
    }
    return { agedToWarm, agedToCold };
  } finally {
    await session.close();
  }
}

/**
 * Returns a snapshot of the current memory graph statistics.
 */
export async function getMemoryStats(deviceId = 'DEV-DEFAULT') {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (hot:Event:Hot) WHERE hot.deviceId = $deviceId OR hot.deviceId IS NULL WITH count(hot) AS hotCount
       MATCH (warm:Event:Warm) WHERE warm.deviceId = $deviceId OR warm.deviceId IS NULL WITH hotCount, count(warm) AS warmCount
       MATCH (cold:Event:Cold) WHERE cold.deviceId = $deviceId OR cold.deviceId IS NULL WITH hotCount, warmCount, count(cold) AS coldCount
       MATCH (s:State {present: true}) WHERE s.deviceId = $deviceId OR s.deviceId IS NULL WITH hotCount, warmCount, coldCount, count(s) AS activeStates
       MATCH (s2:State {present: false}) WHERE s2.deviceId = $deviceId OR s2.deviceId IS NULL WITH hotCount, warmCount, coldCount, activeStates, count(s2) AS pastStates
       RETURN hotCount, warmCount, coldCount, activeStates, pastStates`,
      { deviceId }
    );

    if (result.records.length === 0) {
      return { hot: 0, warm: 0, cold: 0, activeStates: 0, pastStates: 0 };
    }

    const r = result.records[0];
    return {
      hot:          r.get('hotCount').toNumber(),
      warm:         r.get('warmCount').toNumber(),
      cold:         r.get('coldCount').toNumber(),
      activeStates: r.get('activeStates').toNumber(),
      pastStates:   r.get('pastStates').toNumber(),
    };
  } catch (err) {
    // Fallback if multiple MATCH patterns cause issues on Aura Free
    return getMemoryStatsFallback(session, deviceId);
  } finally {
    await session.close();
  }
}

async function getMemoryStatsFallback(session, deviceId = 'DEV-DEFAULT') {
  const s2 = getSession();
  try {
    const [hot, warm, cold, active, past] = await Promise.all([
      s2.run(`MATCH (e:Event) WHERE e.tier = 'hot' AND (e.deviceId = $deviceId OR e.deviceId IS NULL) RETURN count(e) AS c`, { deviceId }),
      s2.run(`MATCH (e:Event) WHERE e.tier = 'warm' AND (e.deviceId = $deviceId OR e.deviceId IS NULL) RETURN count(e) AS c`, { deviceId }),
      s2.run(`MATCH (e:Event) WHERE e.tier = 'cold' AND (e.deviceId = $deviceId OR e.deviceId IS NULL) RETURN count(e) AS c`, { deviceId }),
      s2.run(`MATCH (s:State {present: true}) WHERE s.deviceId = $deviceId OR s.deviceId IS NULL RETURN count(s) AS c`, { deviceId }),
      s2.run(`MATCH (s:State {present: false}) WHERE s.deviceId = $deviceId OR s.deviceId IS NULL RETURN count(s) AS c`, { deviceId }),
    ]);

    const toN = (r) => r.records[0]?.get('c')?.toNumber() ?? 0;
    return {
      hot: toN(hot), warm: toN(warm), cold: toN(cold),
      activeStates: toN(active), pastStates: toN(past),
    };
  } finally {
    await s2.close();
  }
}

/**
 * Returns recent Event nodes for the Memory Book timeline view.
 * @param {number} days - How many past days to include (default 7)
 */
export async function getTimelineEvents(days = 7, deviceId = 'DEV-DEFAULT') {
  const session = getSession();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  try {
    const result = await session.run(
      `MATCH (e:Event)
       WHERE e.timestamp >= $cutoff AND (e.deviceId = $deviceId OR e.deviceId IS NULL)
       RETURN e
       ORDER BY e.timestamp DESC
       LIMIT 200`,
      { cutoff, deviceId }
    );
    return result.records.map((r) => r.get('e').properties);
  } finally {
    await session.close();
  }
}

// ─── Helper: Neo4j Integer ───────────────────────────────────────────────────
import neo4j from 'neo4j-driver';
const neo4jInt = (n) => neo4j.int(n);

/**
 * Parallel extraction of user states & preferences from voice/text queries.
 * As requested by user: states are created from user statements (e.g., liked technologies,
 * favorite genres, current company/job). When a new state is ingested, any previous state
 * for that attribute is automatically invalidated (present = false).
 */
export async function extractAndRecordUserStateFromVoice(prompt, deviceId = 'DEV-DEFAULT') {
  if (!prompt || typeof prompt !== 'string' || prompt.length < 5) return [];

  // Fast check: if input is a question (ends with '?' or asks a question), do not extract/save states!
  const trimmed = prompt.trim();
  if (trimmed.endsWith('?') || /^(what|which|who|when|where|why|how|can you|could you|do you|did i|is my|are my|tell me what|tell me which)/i.test(trimmed)) {
    console.log('[Voice State Extraction] Question detected — skipping state extraction (retrieval mode).');
    return [];
  }

  try {
    const sysPrompt = `You are a strict user preference and state extraction analyzer.
Analyze the user's input.
CRITICAL RULE 1: If the user is ASKING A QUESTION (e.g., "what did I like in the agentic system?", "what is my current company?", "which framework do I like?"), return [] immediately! NEVER extract or save states from interrogative questions!
CRITICAL RULE 2: ONLY extract states if the user is making a DECLARATIVE STATEMENT stating a personal preference, liked technology, favorite topic, or current status (e.g., "I like multi-agent architecture", "Since I like React, build me a dashboard", "My current company is Google").

If valid declarative states are found, return a JSON array: [{"attribute": "FAVORITE_CONCEPT", "value": "Multi-agent systems"}].
Otherwise return [].`;

    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
    });

    const content = res.choices?.[0]?.message?.content || '[]';
    const clean = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const extracted = JSON.parse(clean);

    if (Array.isArray(extracted) && extracted.length > 0) {
      console.log(`[Voice State Extraction] Extracted ${extracted.length} states from user voice:`, extracted);
      const saved = [];
      for (const item of extracted) {
        if (item.attribute && item.value) {
          const stored = await ingestState({
            entity_name: 'User',
            attribute: item.attribute.toUpperCase(),
            value: String(item.value).trim()
          }, deviceId);
          saved.push(stored);
        }
      }
      return saved;
    }
  } catch (err) {
    console.warn('[Voice State Extraction] Warning during extraction:', err.message);
  }
  return [];
}

