import {Task} from '@lit/task';
import {html, css, LitElement} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

interface DayNaps {
	baby: {'name': string};
	day: string;
	naps: Record<string, Nap>;
}
interface Nap {
	wake_up_time: string;
	awake_window: number;
	calm_down_time: number;
}

const napUpdated = new Event('nap-updated', {composed: true});

@customElement('baby-day')
export class BabyDay extends LitElement {
	@property({type: String})
	day = '';

	@state()
	naps: NapSection[] = [];

	constructor() {
		super();
		this.addEventListener('nap-updated', () => this.requestUpdate());
	}

	private _readTask = new Task(this, {
		task: async ([day], {signal}) => {
			const response = await fetch('/api/baby/1/day/' + day, {signal});
			if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
			const dayNaps = await response.json() as DayNaps;
			this.naps = [
				this._renderNap(1, dayNaps.naps[1], 75),
				this._renderNap(2, dayNaps.naps[2], 90),
				this._renderNap(3, dayNaps.naps[3], 90),
				this._renderNap(4, dayNaps.naps[4], 90),
				this._renderNap(5, dayNaps.naps[3], 105),
			];
			return dayNaps;
		},
		args: () => [this.day]
	});

	render() {
		const inner = this._readTask.render({
			pending: () => html`loading...`,
			complete: (dayNaps) => {
				return html`
					<section>
						<h2>${dayNaps.baby.name} &mdash; ${this.day}</h2>
						<div>nap 1 (${this.naps[0].sleepTime} - ${this.naps[1].wakeUpTime})</div>
						<div>nap 2 (${this.naps[1].sleepTime} - ${this.naps[2].wakeUpTime})</div>
						<div>nap 3 (${this.naps[2].sleepTime} - ${this.naps[3].wakeUpTime})</div>
						<div>nap 4 (${this.naps[3].sleepTime} - ${this.naps[4].wakeUpTime})</div>
						<div>night</div>

						<div>total naptime</div>
						<div>total awake time</div>
					</section>
					${this.naps}
				`
			},
			error: (e) => html`${e}`
		});
		return html`<section>${inner}</section>`;
	}

	private _renderNap(number: number, nap: Nap | undefined, defaultAwakeWindow: number) {
		const napSection = new NapSection();
		napSection.day = this.day;
		napSection.number = number;
		if (nap) {
			napSection.wakeUpTime = nap.wake_up_time;
			napSection.awakeWindow = nap.awake_window;
			napSection.calmDown = nap.calm_down_time;
			napSection.estimate(null);
		} else
			napSection.awakeWindow = defaultAwakeWindow;
		return napSection;
	}

	static styles = css`
		section {
			display: flex;
			flex-direction: column;
			width: 400px;
			margin: 0 auto;
		}
	`;
}

@customElement('nap-section')
export class NapSection extends LitElement {
	@property({type: String})
	day = '';

	@property({type: Number})
	number = 0;

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

	private _wakeUpTimeChange(event: Event) {
		this.wakeUpTime = (event.target as HTMLInputElement).value;
	}

	private _awakeWindowChange(event: Event) {
		this.awakeWindow = Number.parseInt((event.target as HTMLInputElement).value);
	}

	private _calmDownChange(event: Event) {
		this.calmDown = Number.parseInt((event.target as HTMLInputElement).value);
	}

	estimate(_event: Event | null) {
		const wakeUpDate = new Date(`${this.day}T${this.wakeUpTime}`);
		this.sleepTime = this._formatTime(wakeUpDate, this.awakeWindow);
		this.putDownTime = this._formatTime(wakeUpDate, this.awakeWindow - this.calmDown);
		this.dispatchEvent(napUpdated);
	}

	private _formatTime(date: Date, deltaMins: number) {
		return new Date(date.getTime() + deltaMins * 60 * 1000).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
	}

	render() {
		return html`
			<section>
				<h2>nap ${this.number}</h2>
				<form>
					<label>
						${this.number === 1 ? 'morning pick-up' : `nap ${this.number - 1} wake-up time`}
						<input type="time" value="${this.wakeUpTime}" @change="${this._wakeUpTimeChange}">
					</label>
					<label>awake window
						<input type="range" value="${this.awakeWindow}" min="30" max="180" step="5" @change="${this._awakeWindowChange}">
						${this.awakeWindow} minutes
					</label>
					<label>calm-down time
						<input type="range" value="${this.calmDown}" max="60" @change="${this._calmDownChange}">
						${this.calmDown} minutes
					</label>
					<input type="button" value="→" @click="${this.estimate}">
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
