import {Task} from '@lit/task';
import {html, css, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

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

@customElement('baby-day')
export class BabyDay extends LitElement {
	@property({type: String})
	day = '';

	private _readTask = new Task(this, {
		task: async ([day], {signal}) => {
			const response = await fetch('/api/baby/1/day/' + day, {signal});
			if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
			return await response.json() as DayNaps;
		},
		args: () => [this.day]
	});

	render() {
		const inner = this._readTask.render({
			pending: () => html`loading...`,
			complete: (dayNaps) => html`
				<section>
					<h2>${dayNaps.baby.name} &mdash; ${this.day}</h2>
					<div>nap 1</div>
					<div>nap 2</div>
					<div>nap 3</div>
					<div>nap 4</div>
					<div>night</div>

					<div>total naptime</div>
					<div>total awake time</div>
				</section>
				${this._renderNap(1, dayNaps.naps[1], 75)}
				${this._renderNap(2, dayNaps.naps[2], 90)}
				`,
			error: (e) => html`${e}`
		});
		return html`<section>${inner}</section>`;
	}

	private _renderNap(number: number, nap: Nap | undefined, defaultAwakeWindow: number) {
		return html`
			<nap-section day="${this.day}" number="${number}" wakeUpTime="${nap?.wake_up_time}"
				awakeWindow="${nap?.awake_window ?? defaultAwakeWindow}" calmDown="${nap?.calm_down_time}"></nap-section>
		`;
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

	private _estimate(_event: Event) {
		const wakeUpDate = new Date(`${this.day}T${this.wakeUpTime}`);
		this.sleepTime = this._formatTime(wakeUpDate, this.awakeWindow);
		this.putDownTime = this._formatTime(wakeUpDate, this.awakeWindow - this.calmDown);
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
					<input type="button" value="→" @click="${this._estimate}">
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
