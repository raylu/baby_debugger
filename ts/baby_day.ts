import {html, css, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('baby-day')
export class BabyDay extends LitElement {
	render() {
		return html`
			<section>
				<h2>randy</h2>
				<div>nap 1</div>
				<div>nap 2</div>
				<div>nap 3</div>
				<div>nap 4</div>
				<div>night</div>

				<div>total naptime</div>
				<div>total awake time</div>
			</section>
			<nap-section number="1" wakeUpTime="07:00" awakeWindow="75"></nap-section>
			<nap-section number="2" awakeWindow="90"></nap-section>
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
		const [hours, mins] = this.wakeUpTime.split(':').map((n) => Number.parseInt(n));
		const sleepMins = hours * 60 + mins + this.awakeWindow;
		this.sleepTime = this._formatTime(sleepMins);
		const putDownMins = sleepMins - this.calmDown;
		this.putDownTime = this._formatTime(putDownMins);
	}

	private _formatTime(mins: number) {
		return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
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
