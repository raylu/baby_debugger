import {Task} from '@lit/task';
import {html, css, LitElement} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {formatDate} from './date';

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
					this._renderNap(1, dayNaps.naps[1], cached, 75),
					this._renderNap(2, dayNaps.naps[2], cached, 90),
					this._renderNap(3, dayNaps.naps[3], cached, 90),
					this._renderNap(4, dayNaps.naps[4], cached, 90),
					this._renderNap(5, dayNaps.naps[3], cached, 105),
				];
				return {'cached': cached};
			} else if (response.status === 404) {
				this.naps = [
					this._renderNap(1, undefined, false, 75),
					this._renderNap(2, undefined, false, 90),
					this._renderNap(3, undefined, false, 90),
					this._renderNap(4, undefined, false, 90),
					this._renderNap(5, undefined, false, 105),
				];
				return {'cached': false};
			} else
				throw new Error(`${response.status} ${response.statusText}`);
		},
		args: () => [this.babyID, this.day],
	});

	private _navigate(event: Event) {
		event.preventDefault();
		history.pushState({}, "", (event.target as HTMLAnchorElement).href);
		this.dispatchEvent(navigate);
	}

	render() {
		const inner = this._readTask.render({
			pending: () => html`loading...`,
			complete: (result) => {
				let date = new Date(this.day);
				date = new Date(date.getTime() + date.getTimezoneOffset()*60*1000);
				const yesterday = new Date();
				yesterday.setDate(date.getDate() - 1);
				const tomorrow = new Date();
				tomorrow.setDate(date.getDate() + 1);
				return html`
					<h1>${this.name} &mdash; ${this.day}</h1>
					<section>
						<a href="${formatDate(yesterday)}" @click="${this._navigate}">←</a>
						<div>
							${result.cached ? html`<div class="offline">offline mode; saving disabled</div>` : ''}
							<div>nap 1 (${this.naps[0].sleepTime} - ${this.naps[1].wakeUpTime})</div>
							<div>nap 2 (${this.naps[1].sleepTime} - ${this.naps[2].wakeUpTime})</div>
							<div>nap 3 (${this.naps[2].sleepTime} - ${this.naps[3].wakeUpTime})</div>
							<div>nap 4 (${this.naps[3].sleepTime} - ${this.naps[4].wakeUpTime})</div>
							<div>night</div>

							<div>total naptime</div>
							<div>total awake time</div>
						</div>
						<a href="${formatDate(tomorrow)}" @click="${this._navigate}">→</a>
					</section>
					${this.naps}
				`
			},
			error: (e) => html`${e}`
		});
		return html`
			<main>${inner}</main>
		`;
	}

	private _renderNap(number: number, nap: Nap | undefined, cached: boolean, defaultAwakeWindow: number) {
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

	static styles = css`
		h1 {
			width: 400px;
			margin: 1em auto;
		}
		section {
			display: flex;
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
			width: 400px;
			margin: 0 auto;
		}
		a {
			color: #58a;
			text-decoration: none;
		}
		.offline {
			color: #c75;
			font-weight: bold;
		}
	`;
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
	calmDown = 0;
	@property({type: String})
	sleepTime = '';
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
		this.sleepTime = this._formatTime(wakeUpDate, this.awakeWindow);
		this.putDownTime = this._formatTime(wakeUpDate, this.awakeWindow - this.calmDown);
	}

	private _formatTime(date: Date, deltaMins: number) {
		return new Date(date.getTime() + deltaMins * 60 * 1000).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
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
				buttonLabel = '→'; break;
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
						<input type="number" value="${this.awakeWindow}" min="30" max="180" step="5" @change="${this._awakeWindowChange}">
						minutes
					</label>
					<label>calm-down time
						<input type="number" value="${this.calmDown}" min="0" max="60" @change="${this._calmDownChange}">
						minutes
					</label>
					<input type="button" value="${buttonLabel}"
						@click="${this._handleClick}" ?disabled="${!this.wakeUpTime || this.saving != SavingStatus.None || this.cached}">
					<label>estimated baby sleep time<input readonly value="${this.sleepTime}"></label>
					<label>estimated baby put-down time<input readonly value="${this.putDownTime}"></label>
				</form>
			</section>`;
	}

	static styles = css`
		section {
			display: flex;
			flex-direction: column;
			width: 400px;
			margin: 0 auto;
		}
		section > form {
			display: flex;
			flex-direction: column;
		}
	`;
}
