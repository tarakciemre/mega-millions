export interface Play {
	numbers: (number | null)[];
	megaBall: number | null;
	megaplier: number | null;
}

export interface TicketData {
	plays: Play[];
	drawDate: string | null;
	ticketDate: string | null;
	rawResponse: string;
}

export interface TicketCard {
	filename: string;
	imageUrl: string;
	data: TicketData | null;
}

export interface MatchResult {
	playIndex: number;
	numbers: number[];
	megaBall: number;
	matchedNumbers: number[];
	megaBallMatch: boolean;
	tier: string;
	prize: string;
	prizeAmount: number;
}

export interface WinningNumbers {
	numbers: number[];
	megaBall: number;
	megaplier: number;
	drawDate: string;
}

export interface CheckWinningsFound {
	status: 'found';
	drawDate: string;
	originalDate: string;
	corrected: boolean;
	winningNumbers: number[];
	winningMegaBall: number;
	megaplierValue: number;
	youtubeLink: string | null;
	matches: MatchResult[];
}

export interface CheckWinningsNotYetDrawn {
	status: 'not_yet_drawn';
	drawDate: string;
	originalDate: string;
	corrected: boolean;
	message: string;
}

export type CheckWinningsResult = CheckWinningsFound | CheckWinningsNotYetDrawn;
