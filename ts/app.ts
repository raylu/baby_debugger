import {html, css, LitElement} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

import './baby_day';
import {formatDate} from './date';

enum Page {
	Root,
	Register,
	BabyDay,
}

interface Baby {
	id: number;
	name: string;
}

@customElement('baby-debugger')
class BabyDebugger extends LitElement {
	@property({type: Array})
	babies: Baby[] = [];

	@state()
	page = Page.Root;
	@state()
	babyID = 0;
	@state()
	day = '';

	constructor() {
		super();
		this.addEventListener('navigate', this._handleUrlChange);
	}

	connectedCallback() {
		super.connectedCallback()
		addEventListener('popstate', this._handleUrlChange.bind(this));
		this._handleUrlChange();
	}
	
	private _handleUrlChange() {
		if (location.pathname === '/')
			this.page = Page.Root;
		else if (location.pathname === '/register')
			this.page = Page.Register;
		else if (location.pathname.startsWith('/baby/')) {
			this.page = Page.BabyDay;
			const split = location.pathname.split('/', 5);
			this.babyID = Number.parseInt(split[2]);
			this.day = split[4];
		}
	}

	private _navigate(event: Event) {
		event.preventDefault();
		history.pushState({}, '', (event.target as HTMLAnchorElement).href);
		this._handleUrlChange();
	}

	private async _register(event: Event) {
		event.preventDefault();
		const username = (this.renderRoot.querySelector('input') as HTMLInputElement).value;
		const challengeResponse = await fetch('/api/register/challenge', {
			'method': 'POST',
			'headers': {'Content-Type': 'application/json'},
			'body': JSON.stringify({username}),
		});
		const pkOpts = await challengeResponse.json();
		pkOpts['challenge'] = this._decode_urlsafebase64(pkOpts['challenge']);
		pkOpts['user']['id'] = this._decode_urlsafebase64(pkOpts['user']['id']);
		const credential = await navigator.credentials.create({'publicKey': pkOpts}) as PublicKeyCredential;

		const credResponse = credential.response as AuthenticatorAttestationResponse;
		const credObj = {
			'type': credential.type,
			'id': credential.id,
			'rawId': this._encode_base64(credential.rawId),
			'response': {
				'attestationObject': this._encode_base64(credResponse.attestationObject),
				'clientDataJSON': this._encode_base64(credResponse.clientDataJSON),
				'transports': credResponse.getTransports(),
			}
		};
		const attestationResponse = await fetch('/api/register/attest', {
			'method': 'POST',
			'headers': {'Content-Type': 'application/json'},
			'body': JSON.stringify({'username': username, 'credential': credObj}),
		});
		if (attestationResponse.ok) {
			history.pushState({}, '', '/');
			this._handleUrlChange();
		}
	}

	private async _login(event: Event) {
		event.preventDefault();
		const challengeResponse = await fetch('/api/login/challenge', {'method': 'POST'});
		const loginReq = await challengeResponse.json();
		loginReq['challenge'] = this._decode_urlsafebase64(loginReq['challenge']);
		await navigator.credentials.get({'publicKey': loginReq});
	}

	private _decode_urlsafebase64(urlsafeb64: string): Uint8Array {
		const b64 = urlsafeb64.replace(/-/g, '+').replace(/_/g, '/');
		return Uint8Array.from(atob(b64), (b) => b.codePointAt(0) as number);
	}

	private _encode_base64(bytes: ArrayBuffer): string {
		return btoa(String.fromCharCode(...new Uint8Array(bytes)));
	}

	render() {
		switch (this.page) {
			case Page.Root:
				const now = new Date();
				const babyLinks = this.babies.map((baby) => html`
					<a href="baby/${baby['id']}/day/${formatDate(now)}" @click="${this._navigate}">${baby['name']}</a>
					<br>
				`)
				return babyLinks.concat([html`
					<p><a href="" @click="${this._login}">login</a>
					<br><a href="/register" @click="${this._navigate}">register</a>
				`]);
			case Page.Register:
				return html`
					<form @submit="${this._register}">
						<label>username: <input type="text"></label>
						<br><input type="submit" value="register">
					</form>
				`
			case Page.BabyDay:
				for (const baby of this.babies)
					if (baby['id'] === this.babyID)
						return html`
							<a href="/" @click="${this._navigate}">home</a>
							<baby-day babyID="${this.babyID}" name="${baby['name']}" day="${this.day}"></baby-day>
						`;
				return html`baby not found`;
		}
	}

	static styles = css`
		a {
			color: #58a;
			text-decoration: none;
		}
	`;
}

(async function() {
	const body = (document.querySelector('body') as HTMLBodyElement);

	const response = await fetch('/api/babies');
	if (!response.ok) {
		body.append(`${response.status}: ${response.statusText}`);
		return;
	}
	const app = new BabyDebugger();
	app.babies = await response.json();
	(document.querySelector('body') as HTMLBodyElement).appendChild(app);

	navigator.serviceWorker.register('/service_worker.js');
	addEventListener('beforeinstallprompt', (event) => {
		console.log('installable!', event);
	})
})();
