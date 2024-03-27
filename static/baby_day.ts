'use strict';

const nap1 = document.querySelector('form#nap1') as HTMLFormElement;
const awakeWindow = nap1.querySelector('.awake_window') as HTMLDivElement;
const awakeWindowInput = (awakeWindow.querySelector('input') as HTMLInputElement);
awakeWindowInput.addEventListener('change', (event) => {
	awakeWindow.querySelector('span').innerText = awakeWindowInput.value + ' minutes';
});
(nap1.querySelector('input[type="button"]') as HTMLInputElement).addEventListener('click', (event) => {
	const [hours, mins] = nap1.querySelector('input[name="pickup"]').value.split(':').map((n) => Number.parseInt(n));
	let sleepMins = hours * 60 + mins + Number.parseInt(awakeWindowInput.value);
	nap1.querySelector('input[name="sleep_time"]').value = `${Math.floor(sleepMins / 60)}:${sleepMins % 60}`;
});
