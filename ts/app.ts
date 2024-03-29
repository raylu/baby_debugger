import {html, css, LitElement} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

import {BabyDay, NapSection} from './baby_day';
import {formatDate} from './date';

enum Page {
	Root,
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

	connectedCallback() {
		super.connectedCallback()
		addEventListener('popstate', this._handleUrlChange.bind(this));
		this._handleUrlChange();
	}
	
	private _handleUrlChange() {
		if (location.pathname === '/')
			this.page = Page.Root;
		else if (location.pathname.startsWith('/baby/'))
			this.page = Page.BabyDay;
	}

	private _navigate(event: Event) {
		event.preventDefault();
		history.pushState({}, "", (event.target as HTMLAnchorElement).href);
		this._handleUrlChange();
	}

	render() {
		const now = new Date();
		switch (this.page) {
			case Page.Root:
				return this.babies.map((baby) => html`
					<a href="baby/${baby['id']}/day/${formatDate(now)}" @click="${this._navigate}">${baby['name']}</a>
				`);
			case Page.BabyDay:
				const split = location.pathname.split('/', 5);
				const babyID = Number.parseInt(split[2]);
				const day = split[4];
				for (const baby of this.babies)
					if (baby['id'] === babyID)
						return html`<baby-day babyID="${babyID}" name="${baby['name']}" day="${day}"></baby-day>`;
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
})();

void BabyDay;
void NapSection;
