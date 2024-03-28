import {html, css, LitElement} from 'lit';
import {customElement, state} from 'lit/decorators.js';

import {BabyDay, NapSection} from './baby_day';

enum Page {
	Root,
	BabyDay,
}

@customElement('baby-debugger')
class BabyDebugger extends LitElement {
	static styles = css`
		a {
			color: #58a;
			text-decoration: none;
		}
	`;

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
		switch (this.page) {
			case Page.Root:
				return html`
					<a href="baby/1/day/2024-03-26" @click="${this._navigate}">baby 1 2024-03-26</a>
				`;
			case Page.BabyDay:
				return html`<baby-day></baby-day>`;
		}
	}
}

const app = new BabyDebugger();
(document.querySelector('body') as HTMLBodyElement).appendChild(app);

void BabyDay;
void NapSection;
