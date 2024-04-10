export function getCookie(key: string): string | null {
	const cookie = RegExp(key + '=[^;]+').exec(document.cookie);
	if (cookie === null)
		return null;
	return decodeURIComponent(cookie.toString().replace(/^[^=]+./, ''));
}
