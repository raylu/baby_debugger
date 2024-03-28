import {html, css, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('nap-section')
class NapSection extends LitElement {
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

	@property({type: String})
	name = '';

	@property({type: String})
	wakeUpTime = '';

	@property({type: Number})
	awakeWindow = 0;

	@property({type: String})
	sleepTime = '';

	private _awakeWindowChange(event: Event) {
		this.awakeWindow = Number.parseInt((event.target as HTMLInputElement).value);
	}

	private _estimate(_event: Event) {
		const [hours, mins] = this.wakeUpTime.split(':').map((n) => Number.parseInt(n));
		let sleepMins = hours * 60 + mins + this.awakeWindow;
		this.sleepTime = `${Math.floor(sleepMins / 60)}:${sleepMins % 60}`;
	}

	render() {
		return html`
			<section>
				<h2>${this.name}</h2>
				<form>
					<label>morning pick-up<input type="time" value="${this.wakeUpTime}" name="pickup"></label>
					<div class="awake_window">
						<label>awake window
							<input type="range" value="${this.awakeWindow}" min="30" max="180" step="5" @change="${this._awakeWindowChange}">
						</label>
						<span>${this.awakeWindow} minutes</span>
					</div>
					<label>calm-down time<input type="range" value="0"></label>
					<input type="button" value="→" @click="${this._estimate}">
					<label>estimated baby sleep time<input readonly name="sleep_time" value="${this.sleepTime}"></label>
					<label>estimated baby put-down time<input readonly value="sleep time - calmdown"></label>
				</form>
			</section>`;
	}
}

const nap1 = document.createElement('nap-section') as NapSection;
nap1.name = 'nap 1';
nap1.wakeUpTime = '07:00';
nap1.awakeWindow = 75;
(document.querySelector('body') as HTMLBodyElement).appendChild(nap1);
