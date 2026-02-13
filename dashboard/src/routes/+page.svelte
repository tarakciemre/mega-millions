<script lang="ts">
	import type { PageData } from './$types';
	import type { CheckWinningsResult, CheckWinningsFound, MatchResult } from '$lib/types';

	let { data }: { data: PageData } = $props();
	let scanning = $state<Record<string, boolean>>({});
	let scanResults = $state<Record<string, any>>({});
	let scanningAll = $state(false);
	let showRaw = $state<Record<string, boolean>>({});

	// Stage 2: editable plays per ticket
	let editablePlays = $state<
		Record<string, { numbers: string; megaBall: string }[]>
	>({});
	let editableDates = $state<Record<string, string>>({});
	let editableMegaplier = $state<Record<string, boolean>>({});
	let checking = $state<Record<string, boolean>>({});
	let checkResults = $state<Record<string, CheckWinningsResult>>({});
	let checkErrors = $state<Record<string, string>>({});

	function getTicketData(ticket: any) {
		return scanResults[ticket.filename] ?? ticket.data;
	}

	function initEditable(filename: string, ticketData: any) {
		if (!ticketData?.plays?.length) return;
		if (editablePlays[filename]) return; // already initialized

		editablePlays[filename] = ticketData.plays.map(
			(p: any) => ({
				numbers: p.numbers?.join(' ') ?? '',
				megaBall: String(p.megaBall ?? '')
			})
		);
		editableDates[filename] = ticketData.drawDate?.slice(0, 10) ?? '';
		editableMegaplier[filename] = ticketData.megaplier ?? false;
	}

	// Initialize editable state for all tickets that have data
	$effect(() => {
		for (const ticket of data.tickets) {
			const td = getTicketData(ticket);
			if (td) initEditable(ticket.filename, td);
		}
	});

	async function scanOne(filename: string, force = false) {
		scanning[filename] = true;
		try {
			const res = await fetch('/api/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ filename, force })
			});
			const json = await res.json();
			if (json.data) {
				scanResults[filename] = json.data;
				// Reset editable state so it re-initializes
				delete editablePlays[filename];
				delete editableDates[filename];
				delete editableMegaplier[filename];
				delete checkResults[filename];
				delete checkErrors[filename];
			} else if (json.error) {
				scanResults[filename] = { error: json.error };
			}
		} catch (e) {
			scanResults[filename] = { error: String(e) };
		}
		scanning[filename] = false;
	}

	async function scanAll() {
		scanningAll = true;
		const uncached = data.tickets.filter(
			(t) => !t.hasCachedData && !scanResults[t.filename]
		);
		for (const ticket of uncached) {
			await scanOne(ticket.filename);
		}
		scanningAll = false;
	}

	async function checkWinnings(filename: string) {
		const plays = editablePlays[filename];
		const drawDate = editableDates[filename];

		if (!plays || !drawDate) return;

		// Parse editable plays back to numbers
		const parsedPlays = plays.map((p) => ({
			numbers: p.numbers
				.trim()
				.split(/[\s,]+/)
				.map((n) => parseInt(n, 10))
				.filter((n) => !isNaN(n)),
			megaBall: parseInt(p.megaBall, 10) || 0
		}));

		const megaplier = editableMegaplier[filename] ?? false;

		checking[filename] = true;
		delete checkErrors[filename];

		try {
			const res = await fetch('/api/check-winnings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ plays: parsedPlays, megaplier, drawDate })
			});
			const json = await res.json();
			if (json.data) {
				checkResults[filename] = json.data;
			} else if (json.error) {
				checkErrors[filename] = json.error;
			}
		} catch (e) {
			checkErrors[filename] = String(e);
		}
		checking[filename] = false;
	}

	function getPrizeBadgeClass(match: MatchResult): string {
		if (match.tier === 'Jackpot') return 'prize-jackpot';
		if (match.prizeAmount > 0) return 'prize-win';
		return 'prize-none';
	}

	const uncachedCount = $derived(data.tickets.filter((t) => !t.hasCachedData).length);
</script>

<svelte:head>
	<title>Mega Millions Scanner Dashboard</title>
</svelte:head>

<div class="container">
	<header>
		<h1>Mega Millions Scanner</h1>
		<div class="stats">
			<span>{data.tickets.length} tickets</span>
			{#if uncachedCount > 0}
				<span>{uncachedCount} unscanned</span>
			{/if}
		</div>
		<div class="header-actions">
			<button
				class="scan-all"
				onclick={() => scanAll()}
				disabled={scanningAll}
			>
				{scanningAll ? 'Scanning...' : 'Scan All'}
			</button>
		</div>
	</header>

	<div class="grid">
		{#each data.tickets as ticket}
			{@const td = getTicketData(ticket)}
			{@const cr = checkResults[ticket.filename]}
			<div class="card">
				<div class="card-image">
					<img src={ticket.imageUrl} alt={ticket.filename} loading="lazy" />
				</div>
				<div class="card-content">
					<div class="filename">{ticket.filename}</div>

					{#if td?.error}
						<div class="error">{td.error}</div>
					{:else if td && editablePlays[ticket.filename]}
						<!-- Stage 1: Extracted plays (editable) -->
						<div class="scan-result">
							<div class="date-row">
								<label>
									<strong>Draw Date:</strong>
									<input
										type="date"
										bind:value={editableDates[ticket.filename]}
										class="date-input"
									/>
								</label>
								<label class="megaplier-toggle">
									<input type="checkbox" bind:checked={editableMegaplier[ticket.filename]} />
									<span class="megaplier-label">Megaplier</span>
								</label>
							</div>

							<div class="plays-editor">
								{#each editablePlays[ticket.filename] as play, i}
									<div class="play-row">
										<span class="play-label">#{i + 1}</span>
										<input
											type="text"
											bind:value={play.numbers}
											class="numbers-input"
											placeholder="5 numbers"
										/>
										<span class="mb-label">MB</span>
										<input
											type="text"
											bind:value={play.megaBall}
											class="megaball-input"
											placeholder="MB"
										/>
									</div>
								{/each}
							</div>

							<div class="actions">
								<button
									class="check-btn"
									onclick={() => checkWinnings(ticket.filename)}
									disabled={checking[ticket.filename]}
								>
									{checking[ticket.filename] ? 'Checking...' : 'Confirm & Check'}
								</button>
								<button
									class="link"
									onclick={() => scanOne(ticket.filename, true)}
									disabled={scanning[ticket.filename]}
								>
									{scanning[ticket.filename] ? 'Scanning...' : 'Re-scan'}
								</button>
								<button
									class="link"
									onclick={() => (showRaw[ticket.filename] = !showRaw[ticket.filename])}
								>
									{showRaw[ticket.filename] ? 'Hide' : 'Show'} Raw
								</button>
							</div>

							{#if showRaw[ticket.filename] && (td.rawResponse || td.rawText)}
								<pre class="ocr">{td.rawResponse ?? td.rawText}</pre>
							{/if}

							{#if checkErrors[ticket.filename]}
								<div class="error">{checkErrors[ticket.filename]}</div>
							{/if}

							<!-- Stage 2: Check Results -->
							{#if cr}
								<div class="results">
									{#if cr.corrected}
										<div class="date-correction">
											Date corrected: {cr.originalDate} → <strong>{cr.drawDate}</strong> (next draw day)
										</div>
									{/if}

									{#if cr.status === 'not_yet_drawn'}
										<div class="not-drawn">
											{cr.message}
										</div>
									{:else}
										{@const found = cr as CheckWinningsFound}
										<div class="winning-row">
											<strong>Winning Numbers ({found.drawDate}):</strong>
											<div class="balls">
												{#each found.winningNumbers as num}
													<span class="ball winning">{String(num).padStart(2, '0')}</span>
												{/each}
												<span class="ball mega winning"
													>{String(found.winningMegaBall).padStart(2, '0')}</span
												>
											</div>
											{#if found.megaplierValue > 1}
												<span class="badge">MEGAPLIER {found.megaplierValue}X</span>
											{/if}
										</div>

										{#each found.matches as match, i}
											<div class="match-row">
												<span class="play-label">#{i + 1}</span>
												<div class="balls">
													{#each match.numbers as num}
														<span
															class="ball"
															class:matched={match.matchedNumbers.includes(num)}
														>
															{String(num).padStart(2, '0')}
														</span>
													{/each}
													<span
														class="ball mega"
														class:matched={match.megaBallMatch}
													>
														{String(match.megaBall).padStart(2, '0')}
													</span>
												</div>
												<span class="prize-badge {getPrizeBadgeClass(match)}"
													>{match.prize}</span
												>
											</div>
										{/each}
									{/if}
								</div>
							{/if}
						</div>
					{:else}
						<!-- Not scanned yet -->
						<div class="muted">Not scanned</div>
						<button
							onclick={() => scanOne(ticket.filename)}
							disabled={scanning[ticket.filename]}
						>
							{scanning[ticket.filename] ? 'Scanning...' : 'Scan'}
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		background: #0f1117;
		color: #e1e1e6;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1.5rem;
	}

	header {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		margin-bottom: 2rem;
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		color: #f0c040;
	}

	.stats {
		display: flex;
		gap: 1rem;
		font-size: 0.85rem;
		color: #888;
	}

	.header-actions {
		margin-left: auto;
	}

	.scan-all {
		padding: 0.5rem 1.2rem;
		background: #10b981;
		color: #fff;
		border: none;
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.scan-all:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	.card {
		display: flex;
		background: #1a1b23;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid #2a2b35;
	}

	.card-image {
		width: 180px;
		min-width: 180px;
		background: #111;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 0.5rem;
	}

	.card-image img {
		width: 100%;
		height: auto;
		max-height: 350px;
		object-fit: contain;
		border-radius: 4px;
	}

	.card-content {
		flex: 1;
		padding: 0.8rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.filename {
		font-size: 0.7rem;
		color: #666;
		word-break: break-all;
	}

	.scan-result {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.date-row {
		font-size: 0.85rem;
	}

	.date-input {
		background: #15161e;
		border: 1px solid #333;
		border-radius: 4px;
		color: #e1e1e6;
		padding: 0.25rem 0.4rem;
		font-size: 0.8rem;
		margin-left: 0.3rem;
	}

	.plays-editor {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.play-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.play-label {
		font-size: 0.75rem;
		color: #888;
		min-width: 1.5rem;
	}

	.numbers-input {
		background: #15161e;
		border: 1px solid #333;
		border-radius: 4px;
		color: #e1e1e6;
		padding: 0.3rem 0.5rem;
		font-size: 0.8rem;
		font-family: monospace;
		width: 160px;
	}

	.mb-label {
		font-size: 0.7rem;
		color: #f0c040;
		font-weight: 700;
	}

	.megaball-input {
		background: #15161e;
		border: 1px solid #d4a520;
		border-radius: 4px;
		color: #f0c040;
		padding: 0.3rem 0.4rem;
		font-size: 0.8rem;
		font-family: monospace;
		width: 36px;
		text-align: center;
	}

	.megaplier-toggle {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		cursor: pointer;
	}

	.megaplier-toggle input {
		cursor: pointer;
	}

	.megaplier-label {
		font-size: 0.65rem;
		color: #888;
	}

	.actions {
		display: flex;
		gap: 0.8rem;
		align-items: center;
		margin-top: 0.2rem;
	}

	.check-btn {
		padding: 0.4rem 1rem;
		background: #f0c040;
		color: #111;
		border: none;
		border-radius: 6px;
		font-weight: 700;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.check-btn:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.link {
		background: none;
		border: none;
		color: #6e9fff;
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0;
	}

	.link:hover {
		text-decoration: underline;
	}

	.link:disabled {
		color: #444;
		cursor: wait;
	}

	.results {
		margin-top: 0.5rem;
		padding: 0.6rem;
		background: #15161e;
		border: 1px solid #2a2b35;
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.winning-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.8rem;
		flex-wrap: wrap;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid #2a2b35;
	}

	.match-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.balls {
		display: flex;
		gap: 3px;
		flex-wrap: wrap;
	}

	.ball {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #2c2d3a;
		border: 2px solid #444;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
		font-weight: 700;
		color: #fff;
	}

	.ball.mega {
		background: #f0c040;
		border-color: #d4a520;
		color: #111;
	}

	.ball.winning {
		background: #1a3a1a;
		border-color: #10b981;
		color: #10b981;
	}

	.ball.winning.mega {
		background: #3a3a1a;
		border-color: #f0c040;
		color: #f0c040;
	}

	.ball.matched {
		background: #10b981;
		border-color: #0d9668;
		color: #fff;
	}

	.ball.mega.matched {
		background: #f0c040;
		border-color: #d4a520;
		color: #111;
		box-shadow: 0 0 8px rgba(240, 192, 64, 0.6);
	}

	.badge {
		background: #f0c040;
		color: #111;
		font-size: 0.6rem;
		font-weight: 700;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
	}

	.prize-badge {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
		margin-left: auto;
	}

	.prize-jackpot {
		background: #f0c040;
		color: #111;
	}

	.prize-win {
		background: #10b981;
		color: #fff;
	}

	.prize-none {
		background: #333;
		color: #888;
	}

	.date-correction {
		font-size: 0.75rem;
		color: #f0c040;
		padding: 0.3rem 0.5rem;
		background: rgba(240, 192, 64, 0.1);
		border-radius: 4px;
	}

	.not-drawn {
		font-size: 0.85rem;
		color: #6e9fff;
		padding: 0.4rem 0.6rem;
		background: rgba(110, 159, 255, 0.1);
		border: 1px solid rgba(110, 159, 255, 0.3);
		border-radius: 6px;
		font-weight: 600;
	}

	.muted {
		color: #555;
		font-size: 0.8rem;
	}

	.error {
		color: #e85d4a;
		font-size: 0.75rem;
	}

	.ocr {
		background: #111;
		border: 1px solid #2a2b35;
		border-radius: 4px;
		padding: 0.5rem;
		font-size: 0.65rem;
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 180px;
		overflow-y: auto;
		color: #999;
	}

	button {
		cursor: pointer;
	}
</style>
