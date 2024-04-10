import {Task} from '@lit/task';
import {html, css, LitElement} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

import {formatDate} from './date';
import globalCSS from './style';

interface DayNaps {
	baby: {'name': string};
	day: string;
	naps: Record<string, Nap>;
	cached: boolean | undefined;
}
interface Nap {
	wake_up_time: string;
	awake_window: number;
	calm_down_time: number;
}

const timeFormat: Intl.DateTimeFormatOptions = {hour: '2-digit', minute: '2-digit'};
const navigate = new Event('navigate', {composed: true});
const napUpdated = new Event('nap-updated', {composed: true});

@customElement('baby-day')
export class BabyDay extends LitElement {
	@property({type: Number})
	babyID = 0;
	@property({type: String})
	name = '';
	@property({type: String})
	day = '';

	@state()
	naps: NapSection[] = [];

	constructor() {
		super();
		this.addEventListener('nap-updated', () => this.requestUpdate());
	}

	private _readTask = new Task(this, {
		task: async ([babyID, day], {signal}) => {
			const response = await fetch(`/api/baby/${babyID}/day/${day}`, {signal});
			if (response.ok) {
				const dayNaps = await response.json() as DayNaps;
				const cached = dayNaps.cached ?? false;
				this.naps = [
					this._makeNap(1, dayNaps.naps[1], cached, 80),
					this._makeNap(2, dayNaps.naps[2], cached, 95),
					this._makeNap(3, dayNaps.naps[3], cached, 95),
					this._makeNap(4, dayNaps.naps[4], cached, 90),
					this._makeNap(5, dayNaps.naps[5], cached, 105),
				];
				return {'cached': cached};
			} else if (response.status === 404) {
				this.naps = [
					this._makeNap(1, undefined, false, 80),
					this._makeNap(2, undefined, false, 95),
					this._makeNap(3, undefined, false, 95),
					this._makeNap(4, undefined, false, 90),
					this._makeNap(5, undefined, false, 105),
				];
				return {'cached': false};
			} else
				throw new Error(`${response.status} ${response.statusText}`);
		},
		args: () => [this.babyID, this.day],
	});

	private _navigate(event: Event) {
		event.preventDefault();
		history.pushState({}, '', (event.target as HTMLAnchorElement).href);
		this.dispatchEvent(navigate);
	}

	render() {
		return this._readTask.render({
			pending: () => html`loading...`,
			complete: (result) => {
				let date = new Date(this.day);
				date = new Date(date.getTime() + date.getTimezoneOffset()*60*1000);
				const yesterday = new Date(date);
				yesterday.setDate(date.getDate() - 1);
				const tomorrow = new Date(date);
				tomorrow.setDate(date.getDate() + 1);

				let totalNapMins = 0;
				let totalAwakeMins = 0;
				this.naps.forEach((napSection, i) => {
					if (!napSection.wakeUpTime)
						return;
					totalAwakeMins += napSection.awakeWindow;
					if (i > 0 && this.naps[i-1].wakeUpTime) {
						const sleepHrs = this.naps[i-1].sleepTimeDate.getHours();
						const sleepMins = this.naps[i-1].sleepTimeDate.getMinutes();
						const [wakeHrs, wakeMins] = napSection.wakeUpTime.split(':', 2).map((n) => parseInt(n));
						totalNapMins += (wakeHrs - sleepHrs) * 60 + wakeMins - sleepMins;
					}
				});
				return html`
					<header>
						<a href="${formatDate(yesterday)}" @click="${this._navigate}">←</a>
						<div>
							<h1>${this.name}</h1>
							<h2>${this.day}</h2>
						</div>
						<a href="${formatDate(tomorrow)}" @click="${this._navigate}">→</a>
					</header>
					<section>
						${result.cached ? html`<div class="offline">offline mode; saving disabled</div>` : ''}
						<div>morning (...${this.naps[0].wakeUpTime})</div>
						<div>nap 1 (${this.naps[0].sleepTimeFormatted} - ${this._formatTime(this.naps[1].wakeUpTime)})</div>
						<div>nap 2 (${this.naps[1].sleepTimeFormatted} - ${this._formatTime(this.naps[2].wakeUpTime)})</div>
						<div>nap 3 (${this.naps[2].sleepTimeFormatted} - ${this._formatTime(this.naps[3].wakeUpTime)})</div>
						<div>nap 4 (${this.naps[3].sleepTimeFormatted} - ${this._formatTime(this.naps[4].wakeUpTime)})</div>
						<div>night (${this.naps[4].sleepTimeFormatted}...)</div>

						<div class="total">
							total naptime: ${this._formatDuration(totalNapMins)}
							<br>total awake time: ${this._formatDuration(totalAwakeMins)}
						</div>
					</section>
					${this.naps}
				`;
			},
			error: (e) => html`${e}`
		});
	}

	private _makeNap(number: number, nap: Nap | undefined, cached: boolean, defaultAwakeWindow: number) {
		const napSection = new NapSection();
		napSection.babyID = this.babyID;
		napSection.day = this.day;
		napSection.number = number;
		napSection.cached = cached;
		if (nap) {
			napSection.wakeUpTime = nap.wake_up_time;
			napSection.awakeWindow = nap.awake_window;
			napSection.calmDown = nap.calm_down_time;
			napSection.estimate();
		} else
			napSection.awakeWindow = defaultAwakeWindow;
		return napSection;
	}

	private _formatTime(time: string): string {
		if (!time)
			return '';
		return new Date(`${this.day}T${time}`).toLocaleTimeString([], timeFormat);
	}

	private _formatDuration(mins: number): string {
		if (mins > 60)
			return `${Math.floor(mins / 60)}hrs ${mins % 60}mins`;
		else
			return mins + ' minutes';
	}

	static styles = [globalCSS, css`
		header {
			display: flex;
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
			gap: 16px;
			margin: 1em auto;
			background-color: #333;
			padding: 8px;
		}
		header > div {
			flex-grow: 1;
		}
		section {
			margin: 0 10px;
			padding: 16px;
			background-color: #333;
			border-radius: 4px;
		}
		a {
			color: #58a;
			text-decoration: none;
		}
		.offline {
			color: #c75;
			font-weight: bold;
		}
		.total {
			margin-top: 1em;
		}
	`];
}

enum SavingStatus {
	None,
	Saving,
	Error
}

@customElement('nap-section')
export class NapSection extends LitElement {
	@property({type: Number})
	babyID = 0;
	@property({type: String})
	day = '';
	@property({type: Number})
	number = 0;
	@property({type: Boolean})
	cached = false;
	@property({type: String})
	wakeUpTime = '';
	@property({type: Number})
	awakeWindow = 0;
	@property({type: Number})
	calmDown = 15;
	@property({type: String})
	sleepTimeFormatted = '';
	@property({attribute: false})
	sleepTimeDate = new Date();
	@property({type: String})
	putDownTime = '';

	@state()
	saving = SavingStatus.None;

	private _wakeUpTimeChange(event: Event) {
		this.wakeUpTime = (event.target as HTMLInputElement).value;
	}

	private _awakeWindowChange(event: Event) {
		this.awakeWindow = Number.parseInt((event.target as HTMLInputElement).value);
	}

	private _calmDownChange(event: Event) {
		this.calmDown = Number.parseInt((event.target as HTMLInputElement).value);
	}

	estimate() {
		const wakeUpDate = new Date(`${this.day}T${this.wakeUpTime}`);
		const sleepTime = this._formatTime(wakeUpDate, this.awakeWindow);
		this.sleepTimeFormatted = sleepTime.formatted;
		this.sleepTimeDate = sleepTime.date;
		this.putDownTime = this._formatTime(wakeUpDate, this.awakeWindow - this.calmDown).formatted;
	}

	private _formatTime(date: Date, deltaMins: number) {
		const dt = new Date(date.getTime() + deltaMins * 60 * 1000);
		return {'date': dt, 'formatted': dt.toLocaleTimeString([], timeFormat)};
	}

	private async _handleClick(_event: Event) {
		this.estimate();
		this.dispatchEvent(napUpdated);
		this.saving = SavingStatus.Saving;
		const response = await fetch(`/api/baby/${this.babyID}/day/${this.day}/nap/${this.number}`, {
			'method': 'POST',
			'headers': {'Content-Type': 'application/json'},
			'body': JSON.stringify({
				'wake_up_time': this.wakeUpTime,
				'awake_window': this.awakeWindow,
				'calm_down_time': this.calmDown,
			})
		});
		if (response.ok)
			this.saving = SavingStatus.None;
		else
			this.saving = SavingStatus.Error;
	}

	render() {
		let buttonLabel;
		switch (this.saving) {
			case SavingStatus.None:
				buttonLabel = 'calculate'; break;
			case SavingStatus.Saving:
				buttonLabel = 'saving...'; break;
			case SavingStatus.Error:
				buttonLabel = 'error';
		}
		return html`
			<section>
				<h2>${this.number == 5 ? 'night' : `nap ${this.number}`}</h2>
				<form>
					<label>
						${this.number === 1 ? 'morning pick-up' : `nap ${this.number - 1} wake-up time`}
						<input type="time" value="${this.wakeUpTime}" @change="${this._wakeUpTimeChange}">
					</label>
					<label>awake window
						<span>
							<input type="number" value="${this.awakeWindow}" min="30" max="180" step="5" @change="${this._awakeWindowChange}">
							minutes
						</span>
					</label>
					<label>calm-down time
						<span>
							<input type="number" value="${this.calmDown}" min="0" max="60" @change="${this._calmDownChange}">
							minutes
						</span>
					</label>
					<input type="button" value="${buttonLabel}"
						@click="${this._handleClick}" ?disabled="${!this.wakeUpTime || this.saving != SavingStatus.None || this.cached}">
					<label>estimated baby sleep time<input readonly value="${this.sleepTimeFormatted}"></label>
					<label>estimated baby put-down time<input readonly value="${this.putDownTime}"></label>
				</form>
			</section>`;
	}

	static styles = [globalCSS, css`
		section {
			display: flex;
			flex-direction: column;
			margin: 1em 10px;
			padding: 16px;
			border-radius: 4px;
			background-color: #333;
		}
		section > form {
			display: flex;
			flex-direction: column;
			gap: 1em;
		}
		h2 {
			margin: 0 0 1em;
		}

		label {
			display: flex;
			justify-content: space-between;
			align-items: center;
		}
		label > input[readonly] {
			border: 0;
			width: 10ch;
		}

		input {
			color: inherit;
			background-color: #111;
			border: 1px solid #777;
			padding: 4px;
		}
		input[type="time"]::-webkit-calendar-picker-indicator {
			filter: invert(0.7);
		}
		input[type="button"] {
			background-color: #7E389E;
			border: 0;
			width: 88px;
			padding: 8px 0;
			border-radius: 38px;
		}
		input[type="button"]:disabled {
			background-color: #7E389E80;
		}
	`];
}
