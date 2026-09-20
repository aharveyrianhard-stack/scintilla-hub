// Paste this trusted helper into the CUA JavaScript session after reading the
// browser instructions. It runs only through supported, tab-scoped CUA APIs.
// It does not export cookies, issue X API calls, or operate another tab/group.
// Pass handles from the verified owned Chrome group; see xfeed/OPERATIONS.md.
async function createXfeedBrowserCycle({ source, intake, ui, passId, resume = null }) {
  const listUrl = 'https://x.com/i/lists/1405188850188759047';
  const cap = await source.capabilities.get('cdp');
  // `resume` is the matching pending pass's resume record from intake /health.
  const pageKey = value => (value === undefined || value === null ? '' : String(value));
  const storedCursors = new Set((resume?.request_cursors ?? []).map(pageKey));
  const cycle = {
    source, intake, ui, cap, passId, listUrl,
    cursor: 0, responses: new Set(), pendingResponses: new Map(), queue: [], pages: 0, saved: 0,
    blocked: null, rateExhausted: null, lastRates: null,
    storedCursors, resumeCursor: resume?.next_cursor ?? null, resumed: false, skippedStoredPages: 0,
    async begin() {
      if (this.blocked || this.rateExhausted) return this.summary();
      await cap.send('Network.enable', { maxTotalBufferSize: 30000000, maxResourceBufferSize: 15000000 });
      this.cursor = (await cap.readEvents({ methods: ['Network.responseReceived'] })).cursor;
      // Reloading restarts the timeline at the newest page, so a resumed pass
      // would re-paginate every page it already stored and break its captured
      // cursor chain. Keep the loaded list and page on from where it stopped.
      if (await source.url() !== listUrl) await source.goto(listUrl);
      else if (!this.storedCursors.size) await source.reload();
      else this.resumed = true;
      await cap.send('Network.enable', { maxTotalBufferSize: 30000000, maxResourceBufferSize: 15000000 });
      return this.read();
    },
    async read() {
      if (this.blocked) return this.summary();
      const deadline = Date.now() + 15000;
      let more = true, batches = 0;
      while (more && batches++ < 3 && Date.now() < deadline - 2500) {
        const events = await cap.readEvents({ afterSequence: this.cursor, methods: ['Network.responseReceived'], limit: 1000, timeoutMs: 2000 });
        this.cursor = events.cursor;
        if (events.truncated) throw Error('Source events were lost; restart a fresh pass instead of claiming continuity.');
        more = events.hasMore;
        for (const event of events.events) {
          const response = event.params?.response;
          if (!response?.url?.includes('/ListLatestTweetsTimeline')) continue;
          const variables = JSON.parse(new URL(response.url).searchParams.get('variables'));
          if (variables.listId !== '1405188850188759047') throw Error('Unexpected list identity');
          const requestId = event.params.requestId;
          if (this.responses.has(requestId) || this.pendingResponses.has(requestId)) continue;
          // A page this pass already stored is not collected or saved again.
          if (this.storedCursors.has(pageKey(variables.cursor))) { this.responses.add(requestId); this.skippedStoredPages++; continue; }
          const headers = Object.fromEntries(Object.entries(response.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
          const rates = Object.fromEntries(Object.entries(headers).filter(([k]) => ['x-rate-limit-limit', 'x-rate-limit-remaining', 'x-rate-limit-reset', 'retry-after'].includes(k)));
          this.lastRates = rates;
          if (response.status !== 200) {
            this.blocked = { status: response.status, rates, observed_at: new Date().toISOString() };
            return this.summary();
          }
          const observed = new Date().toISOString();
          this.pendingResponses.set(requestId, { requestId, variables, rates, observed, bodyAttempts: 0 });
          if (rates['x-rate-limit-remaining'] === '0') this.rateExhausted = { rates, observed_at: observed };
        }
      }
      for (const [requestId, pending] of this.pendingResponses) {
          if (Date.now() >= deadline - 2500) break;
          const { variables, rates, observed } = pending;
          let body;
          try { body = await cap.send('Network.getResponseBody', { requestId }); }
          catch { pending.bodyAttempts++; continue; }
          if (body.base64Encoded) throw Error('Unexpected encoded source response');
          const payload = JSON.parse(body.body);
          const instructions = payload.data?.list?.tweets_timeline?.timeline?.instructions;
          if (!Array.isArray(instructions)) throw Error('Expected a Trading list timeline response');
          const chunks = [];
          for (const instruction of instructions) {
            if (!Array.isArray(instruction.entries)) { chunks.push([instruction]); continue; }
            let entries = [];
            for (const entry of instruction.entries) {
              if (entries.length && JSON.stringify([...entries, entry]).length > 48000) {
                chunks.push([{ ...instruction, entries }]); entries = [];
              }
              entries.push(entry);
            }
            if (entries.length) chunks.push([{ ...instruction, entries }]);
          }
          if (!chunks.length) throw Error('Source response had no retainable timeline instructions');
          for (let index = 0; index < chunks.length; index++) this.queue.push({
            response_type: 'list',
            payload: { data: { list: { tweets_timeline: { timeline: { instructions: chunks[index] } } } } },
            observed_at: observed, source_url: listUrl, pass_id: passId,
            response_id: `${passId}:${requestId}`, request_cursor: variables.cursor ?? null,
            response_chunk_index: index, response_chunk_count: chunks.length,
            rate_headers: rates,
          });
          this.responses.add(requestId); this.pages++;
          this.storedCursors.add(pageKey(variables.cursor));
          this.pendingResponses.delete(requestId);
      }
      return this.summary();
    },
    async form() {
      const newCapture = intake.playwright.getByRole('link', { name: 'New capture', exact: true });
      if (await newCapture.count()) await newCapture.click();
      else if (!(await intake.playwright.getByLabel('Capture JSON', { exact: true }).count())) await intake.goto('http://127.0.0.1:8766/');
    },
    async save(maxChunks = 8) {
      const deadline = Date.now() + 15000;
      for (let i = 0; i < Math.min(8, maxChunks) && this.queue.length && Date.now() < deadline - 3500; i++) {
        await this.form();
        await intake.playwright.getByLabel('Capture JSON', { exact: true }).fill(JSON.stringify(this.queue[0]));
        await intake.playwright.getByRole('button', { name: 'Save capture', exact: true }).click();
        await intake.playwright.getByRole('heading', { name: 'Capture saved', exact: true }).waitFor({ state: 'visible' });
        this.queue.shift(); this.saved++;
      }
      return this.summary();
    },
    async older() {
      if (this.queue.length) throw Error('Save pending source chunks before paginating');
      if (this.pendingResponses.size) throw Error('Read pending response bodies before paginating');
      if (this.blocked || this.rateExhausted) return this.summary();
      if (await source.url() !== listUrl) throw Error('Source tab left the Trading list');
      // This is a tab-scoped ordinary scroll, inside the verified list column.
      // The caller verifies this point against a current source screenshot.
      await ui.scroll([500, 480], 'down', 80);
      return this.read();
    },
    async finish(reason = 'overlap') {
      if (this.queue.length || this.pendingResponses.size || this.blocked) throw Error('Cannot finish with unsaved chunks, pending bodies, or a blocked source');
      await this.form();
      await intake.playwright.getByLabel('Pass JSON', { exact: true }).fill(JSON.stringify({ pass_id: passId, reason }));
      await intake.playwright.getByRole('button', { name: 'Finish pass', exact: true }).click();
      await intake.playwright.getByRole('heading', { name: 'Pass finished', exact: true }).waitFor({ state: 'visible' });
      return intake.playwright.locator('pre').textContent();
    },
    summary() { return { pass_id: passId, pages: this.pages, saved_chunks: this.saved, pending_chunks: this.queue.length, pending_bodies: this.pendingResponses.size, resumed: this.resumed, resume_cursor: this.resumeCursor, skipped_stored_pages: this.skippedStoredPages, blocked: this.blocked, rate_exhausted: this.rateExhausted, rates: this.lastRates }; },
  };
  return cycle;
}
